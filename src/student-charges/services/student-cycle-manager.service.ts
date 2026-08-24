import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TypeMembershipCharge, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import {
  AbsoluteCycle,
  calculateEffectiveBillablePeriod,
  calculateBillableDaysWithPauses,
  MILLISECONDS_IN_DAY,
  buildCycleDescription,
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
  ): Promise<{ generatedCount: number }> {
    let generatedCount = 0;
    const seasonEndDate = membership.courseSeason.season.endDate;

    const allPauses = [
      ...(membership.pauses || []),
      ...(membership.courseSeason.pauses || []),
    ];

    for (let i = 0; i < cycles.length; i++) {
      const currentCycle = cycles[i];

      // 1. Validar si ya existe el CycleEnrollment (omitir CANCELLED en fase 2)
      const existingEnrollment = await tx.cycleEnrollment.findFirst({
        where: {
          studentMembershipId: membership.id,
          cycleStartDate: currentCycle.cycleStartDate,
          cycleEndDate: currentCycle.cycleEndDate,
          status: { not: CycleEnrollmentStatus.CANCELLED }
        },
      });

      if (existingEnrollment) {
        continue;
      }

      // 2. Validar capacidad
      await validateCourseSeasonCapacity(
        tx,
        membership.courseSeasonShiftId,
        currentCycle.cycleStartDate,
        currentCycle.cycleEndDate,
      );

      // 3. Determinar periodo efectivo utilizando enrollmentDate explícito
      const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(
        currentCycle,
        enrollmentDate,
        seasonEndDate,
      );

      if (effectiveStart >= effectiveEnd) {
        continue; // Fuera de temporada o ciclo inválido
      }

      // 4. Calcular días facturables y prorrateos
      const { billableDays } = calculateBillableDaysWithPauses(
        effectiveStart,
        effectiveEnd,
        allPauses,
      );
      const cycleTotalDays =
        (currentCycle.cycleEndDate.getTime() - currentCycle.cycleStartDate.getTime()) /
        MILLISECONDS_IN_DAY;

      let finalBillableDays = billableDays;

      // Aplicar reglas específicas de configuración del season
      if (
        i === 0 &&
        membership.courseSeason.billingConfig?.prorateFirstRecurringFee === false
      ) {
        const { billableDays: billableDaysWithoutLateEntry } =
          calculateBillableDaysWithPauses(currentCycle.cycleStartDate, effectiveEnd, allPauses);
        finalBillableDays = billableDaysWithoutLateEntry;
      }

      const isTruncatedEnd = currentCycle.cycleEndDate.getTime() > seasonEndDate.getTime();
      if (
        isTruncatedEnd &&
        membership.courseSeason.billingConfig?.prorateLastRecurringFee === false
      ) {
        const startForProrating =
          i === 0 && membership.courseSeason.billingConfig?.prorateFirstRecurringFee === false
            ? currentCycle.cycleStartDate
            : effectiveStart;

        const { billableDays: fullCycleBillableDays } = calculateBillableDaysWithPauses(
          startForProrating,
          currentCycle.cycleEndDate,
          allPauses,
        );
        finalBillableDays = fullCycleBillableDays;
      }

      // 5. Calcular monto y descuentos
      let netAmount = 0,
        baseAmount = 0,
        discountAmount = 0,
        description = 'Cuota regular',
        discountReason = '';

      if (options.overrideChargeAmount !== undefined) {
        netAmount = options.overrideChargeAmount;
        baseAmount = options.overrideChargeAmount;
        discountAmount = 0;
        discountReason = '';
        description = buildCycleDescription(
          currentCycle.cycleStartDate,
          currentCycle.cycleEndDate,
          options.billingFrequency,
        );
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
          discountAmount = singlePayment.discountAmount;
          description = singlePayment.description;
          discountReason = singlePayment.appliedDiscounts?.map((d) => d.reason).filter(Boolean).join(', ') || '';
        }
      } else {
        const calc = calculateOnDemandCycleFee(
          membership,
          currentCycle,
          finalBillableDays,
          cycleTotalDays,
        );
        netAmount = calc.netAmount;
        baseAmount = calc.baseAmount;
        discountAmount = calc.discountAmount;
        discountReason = calc.appliedDiscounts?.map((d) => d.reason).filter(Boolean).join(', ') || '';
        description = buildCycleDescription(
          currentCycle.cycleStartDate,
          currentCycle.cycleEndDate,
          options.billingFrequency,
        );

        if (finalBillableDays < cycleTotalDays) {
          description += ` — Prorrateado: ${finalBillableDays} de ${cycleTotalDays} días`;
        }
      }

      // Validar si debemos cobrar el ciclo (útil para inscripción inicial con gracia)
      const shouldChargeCycle = !(i === 0 && !options.chargeInitialCycle);
      let cycleCharge = null;

      // 6. Crear Charge
      if (shouldChargeCycle) {
        cycleCharge = await tx.charge.create({
          data: {
            amount: netAmount,
            pendingAmount: netAmount,
            discountAmount: discountAmount,
            discountReason: discountReason !== '' ? discountReason : null,
            description: description,
            status: netAmount > 0 ? StatusCharge.PENDING : StatusCharge.PAID,
            dueDate: DateUtils.getEndOfUTCDay(currentCycle.cycleStartDate),
          },
        });
      }

      const cycleStatus =
        netAmount <= 0 || !shouldChargeCycle
          ? CycleEnrollmentStatus.CONFIRMED
          : CycleEnrollmentStatus.PENDING;

      // 7. Crear CycleEnrollment
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
        },
      });

      // 8. Crear StudentCharge (compatibilidad legacy)
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
            createdByCron: false, // Por seguridad y compatibilidad manual en regularizaciones
          },
        });
      }

      generatedCount++;
    }

    return { generatedCount };
  }
}
