import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TypeMembershipCharge, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import {
  AbsoluteCycle,
  calculateEffectiveBillablePeriod,
  calculateBillableDaysWithPauses,
  calculateCycleFeeFactor,
  MILLISECONDS_IN_DAY,
  buildCycleDescription,
  getStudentContext,
} from '../student-billing.utils';
import {
  calculateOnDemandCycleFee,
  calculateSinglePaymentFee,
} from '../student-financial.calculator';
import { validateCourseSeasonCapacity } from 'src/common/helpers/capacity.helper';

export interface EnrollmentFinancialOptions {
  chargeInitialCycle: boolean;
  isSeasonFeeOnly: boolean;
  billingFrequency: string;
  overrideChargeAmount?: number;
  forceFullCycleFee?: boolean;
}

@Injectable()
export class StudentCycleManagerService {
  private readonly logger = new Logger(StudentCycleManagerService.name);

  /**
   * Orquestador centralizado para la inscripción a ciclos.
   * Crea el Charge, el CycleEnrollment y el StudentCharge atómicamente.
   *
   * @param membership La membresía del estudiante con todas sus relaciones (courseSeason, paymentPlan, etc.)
   * @param cycles Los ciclos absolutos (matemáticos) a los que se va a inscribir.
   * @param enrollmentDate La fecha real en que el estudiante se reincorpora o inscribe. Determina el prorrateo.
   * @param options Opciones financieras y de configuración.
   * @param tx Transacción obligatoria para mantener atomicidad.
   */
  async enrollCyclesToMembership(
    membership: any,
    cycles: AbsoluteCycle[],
    enrollmentDate: Date,
    options: EnrollmentFinancialOptions,
    tx: Prisma.TransactionClient,
  ): Promise<{ generatedCount: number; generatedChargeIds: string[] }> {
    let generatedCount = 0;
    const generatedChargeIds: string[] = [];
    const seasonEndDate = membership.courseSeason.season.endDate;

    const allPauses = [
      ...(membership.pauses || []),
      ...(membership.courseSeason.pauses || []),
    ];

    // 0. Bloquear la fila de la membresía para serializar asignaciones de intentos y prevenir concurrencia
    if (typeof (tx as any).$queryRaw === 'function') {
      await tx.$queryRaw`
        SELECT id FROM "student_memberships" 
        WHERE id = ${membership.id} 
        FOR UPDATE
      `;
    }

    for (let i = 0; i < cycles.length; i++) {
      const currentCycle = cycles[i];

      // 1. Validar si ya existe un CycleEnrollment vigente (omitir CANCELLED en re-inscripciones)
      const existingActiveEnrollment = await tx.cycleEnrollment.findFirst({
        where: {
          studentMembershipId: membership.id,
          cycleStartDate: currentCycle.cycleStartDate,
          cycleEndDate: currentCycle.cycleEndDate,
          status: { not: CycleEnrollmentStatus.CANCELLED }
        },
      });

      if (existingActiveEnrollment) {
        continue;
      }

      // 2. Determinar el siguiente número de intento para este período histórico
      const lastAttemptRecord = await tx.cycleEnrollment.findFirst({
        where: {
          studentMembershipId: membership.id,
          cycleStartDate: currentCycle.cycleStartDate,
          cycleEndDate: currentCycle.cycleEndDate,
        },
        orderBy: { attempt: 'desc' },
        select: { attempt: true },
      });

      const nextAttempt = (lastAttemptRecord?.attempt ?? 0) + 1;

      // 3. Validar capacidad
      await validateCourseSeasonCapacity(
        tx,
        membership.courseSeasonShiftId,
        currentCycle.cycleStartDate,
        currentCycle.cycleEndDate,
      );

      const cycleEnrollmentDate = currentCycle.requestedEnrollmentDate || enrollmentDate;

      // 4. Determinar periodo efectivo utilizando cycleEnrollmentDate
      const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(
        currentCycle,
        cycleEnrollmentDate,
        seasonEndDate,
      );

      if (effectiveStart >= effectiveEnd) {
        continue; // Fuera de temporada o ciclo inválido
      }

      // 5. Determinar factor de cobro usando la nueva regla de mitad de ciclo
      const feeFactor = calculateCycleFeeFactor(
        currentCycle.cycleStartDate,
        currentCycle.cycleEndDate,
        effectiveStart,
        options.forceFullCycleFee
      );

      // 6. Calcular monto y descuentos
      let netAmount = 0,
        baseAmount = 0,
        adjustmentAmount = 0,
        description = 'Cuota regular',
        adjustmentReason = '';

      if (options.overrideChargeAmount !== undefined) {
        netAmount = options.overrideChargeAmount;
        baseAmount = options.overrideChargeAmount;
        adjustmentAmount = 0;
        adjustmentReason = '';
        description = getStudentContext(
          membership,
          buildCycleDescription(
            currentCycle.cycleStartDate,
            currentCycle.cycleEndDate,
            options.billingFrequency,
          )
        ).trim();
      } else if (options.isSeasonFeeOnly) {
        const singlePaymentBaseAmount = Number(
          membership.courseSeason.billingConfig?.seasonFee || 0,
        );
        const singlePaymentDiscountPercent = (membership.studentDiscounts || []).reduce(
          (acc, d) => acc + Number(d.seasonFeeDiscountPercent || 0),
          0,
        );

        const singlePayment = calculateSinglePaymentFee(
          membership,
          singlePaymentBaseAmount,
          singlePaymentDiscountPercent,
        );

        if (singlePayment.hasSinglePaymentAmount) {
          netAmount = singlePayment.netAmount;
          baseAmount = singlePayment.baseAmount;
          adjustmentAmount = singlePayment.adjustmentAmount;
          description = singlePayment.description;
          adjustmentReason = singlePayment.appliedDiscounts?.map((d) => d.reason).filter(Boolean).join(', ') || '';
        }
      } else {
        const calc = calculateOnDemandCycleFee(
          membership,
          currentCycle,
          feeFactor,
        );
        netAmount = calc.netAmount;
        baseAmount = calc.baseAmount;
        adjustmentAmount = calc.adjustmentAmount;
        adjustmentReason = calc.appliedDiscounts?.map((d) => d.reason).filter(Boolean).join(', ') || '';
        description = getStudentContext(
          membership,
          buildCycleDescription(
            currentCycle.cycleStartDate,
            currentCycle.cycleEndDate,
            options.billingFrequency,
          )
        ).trim();

        if (feeFactor === 0.5) {
          description += ` — Inscripción pasada la mitad del ciclo (50%)`;
        }
      }

      // Validar si debemos cobrar el ciclo (útil para inscripción inicial con gracia)
      const shouldChargeCycle = !(i === 0 && !options.chargeInitialCycle);
      let cycleCharge = null;

      // 7. Crear Charge independiente para este intento
      if (shouldChargeCycle) {
        cycleCharge = await tx.charge.create({
          data: {
            amount: netAmount,
            pendingAmount: netAmount,
            adjustmentAmount: adjustmentAmount,
            adjustmentReason: adjustmentReason !== '' ? adjustmentReason : null,
            description: description,
            status: netAmount > 0 ? StatusCharge.PENDING : StatusCharge.PAID,
            dueDate: DateUtils.getEndOfUTCDay(currentCycle.cycleStartDate),
          },
        });
        generatedChargeIds.push(cycleCharge.id);
      }

      const cycleStatus =
        netAmount <= 0 || !shouldChargeCycle
          ? CycleEnrollmentStatus.CONFIRMED
          : CycleEnrollmentStatus.PENDING;

      // 8. Crear CycleEnrollment con su intento correspondiente
      await tx.cycleEnrollment.create({
        data: {
          studentMembershipId: membership.id,
          courseSeasonId: membership.courseSeasonId,
          courseSeasonShiftId: membership.courseSeasonShiftId,
          chargeId: cycleCharge?.id || null,
          cycleStartDate: currentCycle.cycleStartDate,
          cycleEndDate: currentCycle.cycleEndDate,
          effectiveStartDate: effectiveStart,
          status: cycleStatus,
          attempt: nextAttempt,
        },
      });

      // 9. Crear StudentCharge con su intento correspondiente
      if (shouldChargeCycle && cycleCharge) {
        await tx.studentCharge.create({
          data: {
            studentMembershipId: membership.id,
            chargeId: cycleCharge.id,
            type: options.isSeasonFeeOnly
              ? TypeMembershipCharge.SEASON_FEE
              : TypeMembershipCharge.RECURRING_FEE,
            billingYear: currentCycle.billingYear,
            billingMonth: currentCycle.billingMonth,
            billingCycle: options.billingFrequency === 'MONTHLY' ? null : currentCycle.billingCycle,
            createdByCron: false,
            attempt: nextAttempt,
          },
        });
      }

      generatedCount++;
    }

    return { generatedCount, generatedChargeIds };
  }
}
