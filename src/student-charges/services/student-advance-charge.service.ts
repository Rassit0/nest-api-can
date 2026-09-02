import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentCourseSeasonValidator } from '../validators/student-course-season.validator';
import { PrismaErrorUtils } from 'src/utils/prisma-error.util';
import { getAbsoluteSeasonCycles, findCycleContainingDate, MILLISECONDS_IN_DAY, calculateEffectiveBillablePeriod, calculateBillableDaysWithPauses, calculateCycleFeeFactor, buildCycleDescription } from '../student-billing.utils';
import { calculateOnDemandCycleFee } from '../student-financial.calculator';
import { validateCourseSeasonCapacity } from 'src/common/helpers/capacity.helper';
import { TypeMembershipCharge, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';

import { StudentCycleManagerService } from './student-cycle-manager.service';

@Injectable()
export class StudentAdvanceChargeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly cycleManager: StudentCycleManagerService,
  ) {}

  private async validateAndGetMembershipForAdvance(membershipId: string) {
    const membership = await this.membershipRepo.getMembershipOrThrow(membershipId);

    StudentCourseSeasonValidator.assertIsActive(
      membership.courseSeason,
      'errors.INACTIVE_COURSE_SEASON',
    );

    if (membership.status === 'SUSPENDED') {
      throw new BadRequestException('errors.MEMBERSHIP_SUSPENDED');
    }

    return membership;
  }

  private async getValidCyclesForPurchase(membership: any, requestedCycles: { cycleStartDate: Date; enrollmentDate?: string }[], tx: any = this.prisma) {
    // 1. Validar duplicados en la entrada
    const uniqueDates = new Set(requestedCycles.map(c => c.cycleStartDate.getTime()));
    if (uniqueDates.size !== requestedCycles.length) {
      throw new BadRequestException('Se detectaron fechas de ciclo duplicadas en la solicitud.');
    }

    const allCycles = getAbsoluteSeasonCycles(
      membership.courseSeason.season.startDate,
      membership.courseSeason.season.endDate,
      membership.courseSeason.billingConfig.billingFrequency
    );

    // 2. Validar que todas las fechas correspondan a un ciclo absoluto válido
    const validCyclesToPurchase = [];
    for (const reqCycle of requestedCycles) {
      const cycle = allCycles.find(c => c.cycleStartDate.getTime() === reqCycle.cycleStartDate.getTime());
      if (!cycle) {
        throw new BadRequestException(`La fecha ${reqCycle.cycleStartDate.toISOString()} no corresponde a un inicio de ciclo válido en esta temporada.`);
      }
      validCyclesToPurchase.push({
        ...cycle,
        requestedEnrollmentDate: reqCycle.enrollmentDate ? new Date(reqCycle.enrollmentDate) : undefined,
      });
    }

    // 3. Ignorar (o rechazar) ciclos que ya terminaron antes de que el estudiante se inscribiera
    const cyclesAfterStart = validCyclesToPurchase.filter(cycle => 
      cycle.cycleEndDate.getTime() > membership.startedAt.getTime()
    );

    if (cyclesAfterStart.length !== validCyclesToPurchase.length) {
      throw new BadRequestException('No se pueden comprar ciclos que finalizaron antes de la inscripción del estudiante.');
    }

    for (const cycle of validCyclesToPurchase) {
      if (cycle.requestedEnrollmentDate) {
        if (cycle.requestedEnrollmentDate.getTime() < cycle.cycleStartDate.getTime() || cycle.requestedEnrollmentDate.getTime() > cycle.cycleEndDate.getTime()) {
           throw new BadRequestException(`La fecha de inscripción seleccionada (${cycle.requestedEnrollmentDate.toISOString()}) debe estar dentro del rango del ciclo (${cycle.cycleStartDate.toISOString()} - ${cycle.cycleEndDate.toISOString()}).`);
        }
      }
    }

    // 4. Validar que no se estén comprando ciclos ya inscritos (usando tx)
    const existingEnrollments = await tx.cycleEnrollment.findMany({
      where: { 
        studentMembershipId: membership.id,
        status: { not: CycleEnrollmentStatus.CANCELLED },
        cycleStartDate: { in: requestedCycles.map(c => c.cycleStartDate) }
      },
      select: { cycleStartDate: true, cycleEndDate: true }
    });

    if (existingEnrollments.length > 0) {
      throw new BadRequestException('Uno o más ciclos seleccionados ya se encuentran registrados en la membresía.');
    }

    return validCyclesToPurchase;
  }

  /**
   * Obtiene la lista de ciclos disponibles para ser adelantados.
   */
  async getAvailableCycles(membershipId: string) {
    const membership = await this.validateAndGetMembershipForAdvance(membershipId);
    
    const allCycles = getAbsoluteSeasonCycles(
      membership.courseSeason.season.startDate,
      membership.courseSeason.season.endDate,
      membership.courseSeason.billingConfig.billingFrequency
    );

    const existingEnrollments = await this.prisma.cycleEnrollment.findMany({
      where: { 
        studentMembershipId: membership.id,
        status: { not: CycleEnrollmentStatus.CANCELLED }
      },
      select: { cycleStartDate: true, cycleEndDate: true }
    });

    const cyclesWithStatus = allCycles
      .filter(cycle => cycle.cycleEndDate.getTime() > membership.startedAt.getTime())
      .map(cycle => {
        const isEnrolled = existingEnrollments.some(e => 
          e.cycleStartDate.getTime() === cycle.cycleStartDate.getTime() &&
          e.cycleEndDate.getTime() === cycle.cycleEndDate.getTime()
        );
        return {
          ...cycle,
          isEnrolled
        };
      });

    return cyclesWithStatus;
  }

  /**
   * Genera el Preview On-Demand de la compra explícita de ciclos futuros.
   */
  async previewAdvanceCharges(membershipId: string, requestedCycles: { cycleStartDate: Date; enrollmentDate?: string }[]) {
    const membership = await this.validateAndGetMembershipForAdvance(membershipId);
    const cyclesToPurchase = await this.getValidCyclesForPurchase(membership, requestedCycles);

    if (cyclesToPurchase.length === 0) {
      return { charges: [], breakdown: { totalBaseAmount: 0, totalDiscount: 0, totalNetAmount: 0 } };
    }

    const previewCharges = [];
    let subtotal = 0;
    let totalDiscounts = 0;
    let total = 0;

    const allPauses = [
      ...(membership.pauses || []),
      ...(membership.courseSeason.pauses || []),
    ];

    for (let i = 0; i < cyclesToPurchase.length; i++) {
      const cycle = cyclesToPurchase[i];
      // Para adelantos, usamos el requestedEnrollmentDate del ciclo, o la fecha actual
      const simulatedEnrollmentDate = cycle.requestedEnrollmentDate || new Date();
      const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(cycle, simulatedEnrollmentDate, membership.courseSeason.season.endDate);
      
      if (effectiveStart >= effectiveEnd) continue; // Fuera de temporada

      const { billableDays, pauseDays } = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, allPauses);
      const cycleTotalDays = (cycle.cycleEndDate.getTime() - cycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY;

      const feeFactor = calculateCycleFeeFactor(
        cycle.cycleStartDate,
        cycle.cycleEndDate,
        effectiveStart,
        false // En preview de adelantos, no hay forceFullCycleFee
      );

      const cycleFee = calculateOnDemandCycleFee(
        membership,
        cycle,
        feeFactor
      );

      const adjustmentReason = cycleFee.appliedDiscounts?.map(d => d.reason).filter(Boolean).join(', ');

      subtotal += cycleFee.baseAmount;
      totalDiscounts += cycleFee.adjustmentAmount;
      total += cycleFee.netAmount;

      let description = buildCycleDescription(
         cycle.cycleStartDate,
         cycle.cycleEndDate,
         membership.courseSeason.billingConfig.billingFrequency
      );
      if (feeFactor === 0.5) {
        description += ` — Inscripción pasada la mitad del ciclo (50%)`;
      }
      previewCharges.push({
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
        effectiveStartDate: effectiveStart,
        baseAmount: cycleFee.baseAmount,
        adjustmentAmount: cycleFee.adjustmentAmount,
        adjustmentReason: adjustmentReason,
        amount: cycleFee.netAmount,
        dueDate: new Date(Date.UTC(effectiveStart.getUTCFullYear(), effectiveStart.getUTCMonth(), effectiveStart.getUTCDate(), 23, 59, 59, 999)),
        totalDays: cycleTotalDays,
        billableDays,
        pauseDays,
        description: `Inscripción a ciclo: ${description}`
      });
    }

    return {
      charges: previewCharges,
      breakdown: { 
        totalBaseAmount: subtotal, 
        totalDiscount: totalDiscounts, 
        totalNetAmount: total 
      }
    };
  }

  /**
   * Concreta la compra explícita On-Demand de ciclos futuros.
   */
  async purchaseAdvanceCycles(membershipId: string, requestedCycles: { cycleStartDate: Date; enrollmentDate?: string }[]) {
    const membership = await this.validateAndGetMembershipForAdvance(membershipId);
    
    // Verificamos antes de entrar a la transacción para validaciones tempranas
    await this.getValidCyclesForPurchase(membership, requestedCycles);

    try {
      let generatedCount = 0;
      await this.prisma.$transaction(async (tx) => {
        // En la transacción resolvemos de nuevo los disponibles para asegurar que no nos ganen por concurrencia
        const cyclesToPurchase = await this.getValidCyclesForPurchase(membership, requestedCycles, tx);

        if (cyclesToPurchase.length === 0) {
            return; // Ya no hay ciclos
        }

        // Delegar la creación al orquestador central
        const options = {
          chargeInitialCycle: true, // Siempre cobramos en un adelanto
          isSeasonFeeOnly: false, // Adelantos siempre son RECURRING
          billingFrequency: membership.courseSeason.billingConfig.billingFrequency,
          forceFullCycleFee: false // Por ahora, la compra de adelantos usa forceFullCycleFee=false, a menos que se añada al DTO.
        };

        const result = await this.cycleManager.enrollCyclesToMembership(
          membership,
          cyclesToPurchase,
          new Date(), // enrollmentDate parameter ya no se usa fijamente
          options,
          tx
        );
        generatedCount = result.generatedCount;
      });

      if (generatedCount === 0) {
        return { message: 'No hay más cuotas disponibles para comprar en la temporada.' };
      }

      return { message: `Se compraron exitosamente ${generatedCount} cuotas futuras.` };
    } catch (error) {
      if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
        throw new BadRequestException(
          'El ciclo solicitado ya se encontraba comprado o fue procesado de forma concurrente.',
        );
      }
      throw error;
    }
  }
}
