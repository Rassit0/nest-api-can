import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentCourseSeasonValidator } from '../validators/student-course-season.validator';
import { PrismaErrorUtils } from 'src/utils/prisma-error.util';
import { getAbsoluteSeasonCycles, findCycleContainingDate, MILLISECONDS_IN_DAY, calculateEffectiveBillablePeriod, calculateBillableDaysWithPauses, buildCycleDescription } from '../student-billing.utils';
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

  private async getUnenrolledCycles(membership: any, quantity: number) {
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

    const unenrolledCycles = allCycles.filter(cycle => {
      // Ignore cycles that ended before the student's membership started
      if (cycle.cycleEndDate.getTime() <= membership.startedAt.getTime()) {
        return false;
      }

      return !existingEnrollments.some(e => 
        e.cycleStartDate.getTime() === cycle.cycleStartDate.getTime() &&
        e.cycleEndDate.getTime() === cycle.cycleEndDate.getTime()
      );
    });

    if (unenrolledCycles.length === 0) {
      return [];
    }

    if (unenrolledCycles.length < quantity) {
      throw new BadRequestException(
        `Solo quedan ${unenrolledCycles.length} cuotas disponibles en la temporada. No se pueden adelantar ${quantity}.`,
      );
    }

    return unenrolledCycles.slice(0, quantity);
  }

  /**
   * Genera el Preview On-Demand de la compra explícita de ciclos futuros.
   */
  async previewAdvanceCharges(membershipId: string, quantity: number) {
    const membership = await this.validateAndGetMembershipForAdvance(membershipId);
    const cyclesToPurchase = await this.getUnenrolledCycles(membership, quantity);

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
      const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(cycle, new Date(), membership.courseSeason.season.endDate);
      
      if (effectiveStart >= effectiveEnd) continue; // Fuera de temporada

      const { billableDays, pauseDays } = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, allPauses);
      const cycleTotalDays = (cycle.cycleEndDate.getTime() - cycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY;

      let finalBillableDays = billableDays;
      const isTruncatedEnd = cycle.cycleEndDate.getTime() > membership.courseSeason.season.endDate.getTime();
      if (isTruncatedEnd && membership.courseSeason.billingConfig?.prorateLastRecurringFee === false) {
          const { billableDays: fullCycleBillableDays } = calculateBillableDaysWithPauses(effectiveStart, cycle.cycleEndDate, allPauses);
          finalBillableDays = fullCycleBillableDays;
      }

      const cycleFee = calculateOnDemandCycleFee(
        membership,
        cycle,
        finalBillableDays,
        cycleTotalDays
      );

      const discountReason = cycleFee.appliedDiscounts?.map(d => d.reason).filter(Boolean).join(', ');

      subtotal += cycleFee.baseAmount;
      totalDiscounts += cycleFee.discountAmount;
      total += cycleFee.netAmount;

      let description = buildCycleDescription(
         cycle.cycleStartDate,
         cycle.cycleEndDate,
         membership.courseSeason.billingConfig.billingFrequency
      );
      if (finalBillableDays < cycleTotalDays) {
        description += ` — Prorrateado: ${finalBillableDays} de ${cycleTotalDays} días`;
      }

      previewCharges.push({
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
        effectiveStartDate: effectiveStart,
        baseAmount: cycleFee.baseAmount,
        discountAmount: cycleFee.discountAmount,
        discountReason: discountReason,
        amount: cycleFee.netAmount,
        dueDate: new Date(Date.UTC(effectiveStart.getUTCFullYear(), effectiveStart.getUTCMonth(), effectiveStart.getUTCDate(), 23, 59, 59, 999)),
        totalDays: cycleTotalDays,
        billableDays,
        pauseDays,
        description: `Adelanto de Cuota: ${description}`
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
  async purchaseAdvanceCycles(membershipId: string, quantity: number) {
    const membership = await this.validateAndGetMembershipForAdvance(membershipId);
    
    // Verificamos antes de entrar a la transacción para validaciones tempranas
    await this.getUnenrolledCycles(membership, quantity);

    try {
      let generatedCount = 0;
      await this.prisma.$transaction(async (tx) => {
        // En la transacción resolvemos de nuevo los disponibles para asegurar que no nos ganen por concurrencia
        const existingEnrollments = await tx.cycleEnrollment.findMany({
            where: { 
              studentMembershipId: membership.id,
              status: { not: CycleEnrollmentStatus.CANCELLED }
            },
            select: { cycleStartDate: true, cycleEndDate: true }
        });

        const allCycles = getAbsoluteSeasonCycles(
            membership.courseSeason.season.startDate,
            membership.courseSeason.season.endDate,
            membership.courseSeason.billingConfig.billingFrequency
        );

        const unenrolledCycles = allCycles.filter(cycle => {
            // Ignore cycles that ended before the student's membership started
            if (cycle.cycleEndDate.getTime() <= membership.startedAt.getTime()) {
              return false;
            }

            return !existingEnrollments.some(e => 
              e.cycleStartDate.getTime() === cycle.cycleStartDate.getTime() &&
              e.cycleEndDate.getTime() === cycle.cycleEndDate.getTime()
            );
        });

        if (unenrolledCycles.length === 0) {
            return; // Ya no hay ciclos
        }
        if (unenrolledCycles.length < quantity) {
            throw new BadRequestException(
                `Solo quedan ${unenrolledCycles.length} cuotas disponibles en la temporada. No se pueden adelantar ${quantity}.`,
            );
        }

        const cyclesToPurchase = unenrolledCycles.slice(0, quantity);
        // Delegar la creación al orquestador central
        const options = {
          chargeInitialCycle: true, // Siempre cobramos en un adelanto
          isSeasonFeeOnly: false, // Adelantos siempre son RECURRING
          billingFrequency: membership.courseSeason.billingConfig.billingFrequency
        };

        const result = await this.cycleManager.enrollCyclesToMembership(
          membership,
          cyclesToPurchase,
          new Date(), // La fecha de inscripción material (hoy) para la compra de adelantos
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
