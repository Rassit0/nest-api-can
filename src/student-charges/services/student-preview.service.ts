import { Injectable } from '@nestjs/common';
import {
  StudentMembershipWithRelations,
  calculateRegistrationFee,
  calculateSinglePaymentFee,
  calculateOnDemandCycleFee,
} from '../student-financial.calculator';
import { formatDiscountsDescription, getAbsoluteSeasonCycles, findCycleContainingDate, calculateEffectiveBillablePeriod, calculateBillableDaysWithPauses, MILLISECONDS_IN_DAY, buildCycleDescription, resolveFinancialEnrollmentOptions } from '../student-billing.utils';
import { DateUtils } from 'src/utils/date.utils';
import {
  TypeMembershipCharge,
  StatusCourseSeason,
} from 'src/generated/prisma/client';
import {
  PreviewCharge,
  ExistingChargeMinimal,
  PreviewResult,
} from '../interfaces/student-charge.types';
import { PreviewChargeFactory } from '../factories/preview-charge.factory';

@Injectable()
export class StudentPreviewService {
  /**
   * FASE 2.5: Genera el Preview utilizando exclusivamente el modelo On-Demand (sin persistir nada).
   * Calcula matemáticamente los ciclos, encuentra el ciclo correspondiente a la inscripción,
   * prorratea los días efectivos y descuenta las pausas interseccionadas.
   */
  public extractOnDemandPreviewCharges(
    membership: StudentMembershipWithRelations,
  ): PreviewResult {
    let charges: PreviewCharge[] = [];
    const isSeasonFeeOnly =
      membership.courseSeason.billingConfig?.billingType === 'SINGLE_ONLY' ||
      (membership.courseSeason.billingConfig?.billingType === 'BOTH' &&
        membership.paymentPlan?.isSinglePayment === true);
    const isFullPaymentPlan = membership.paymentPlan?.isSinglePayment === true;
    
    const { chargeRegistration, chargeInitialCycle } = resolveFinancialEnrollmentOptions(membership.isMigrated, {
       chargeRegistration: membership.chargeRegistration,
       chargeInitialCycle: membership.chargeInitialCycle,
       chargeRegistrationOnMigration: membership.chargeRegistrationOnMigration,
       chargeCurrentMonthOnMigration: membership.chargeCurrentMonthOnMigration
    });
    
    // 1. Inscripción
    charges = charges.concat(
      this.extractRegistrationCharge(membership, null, chargeRegistration),
    );

    const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';
    const seasonStartDate = membership.courseSeason.season.startDate;
    const seasonEndDate = membership.courseSeason.season.endDate;

    // 2. Obtener todos los ciclos matemáticos de la Season
    const allCycles = getAbsoluteSeasonCycles(seasonStartDate, seasonEndDate, billingFrequency);

    if (isSeasonFeeOnly) {
       // Para SINGLE, todo es un solo ciclo (el ciclo 1).
       const singleCycle = allCycles[0];
       if (singleCycle) {
          // Extraemos los límites efectivos
          const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(singleCycle, membership.startedAt, seasonEndDate);
          
          // Todas las pausas del estudiante y de la season
          const allPauses = [
            ...(membership.pauses || []),
            ...(membership.courseSeason.pauses || []),
          ];

          const { billableDays, totalDays } = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, allPauses);

          // Calculamos el importe
          // Para SINGLE normalmente se usa calculateSinglePaymentFee, que ya tiene lógica propia.
          // Reutilizaremos calculateSinglePaymentFee pero le pasaremos los descuentos/factores simulados si hace falta.
          // Como calculateSinglePaymentFee ya calcula factor basado en membership.startedAt, lo usamos directamente.
          charges = charges.concat(
             this.extractSinglePaymentCharge(membership, null, chargeInitialCycle, allCycles as any)
          );
       }
    } else {
       // Frecuencias recurrentes
       // 3. Encontrar el ciclo que contiene la fecha de inicio
       const firstCycle = findCycleContainingDate(allCycles, membership.startedAt);
       if (firstCycle) {
           const advanceCycles = isFullPaymentPlan ? allCycles.length : Math.max(1, membership.paymentPlan?.advanceCycles || 1);
           const cycleIndex = allCycles.findIndex(c => c.cycleCounter === firstCycle.cycleCounter);
           
           for (let i = 0; i < advanceCycles; i++) {
               const currentCycle = allCycles[cycleIndex + i];
               if (!currentCycle) break;
               
               // Para el primer ciclo, el enrollment date es startedAt. 
               // Para los siguientes, es simplemente el inicio del ciclo (porque ya está inscrito).
               const enrollmentDateForCycle = (i === 0) ? membership.startedAt : currentCycle.cycleStartDate;
               
               // 4. Calcular período efectivo para este ciclo
               const { effectiveStart, effectiveEnd } = calculateEffectiveBillablePeriod(currentCycle, enrollmentDateForCycle, seasonEndDate);
               
               if (effectiveStart >= effectiveEnd) continue; // Fuera de temporada
               
               // 5. Integrar pausas
               const allPauses = [
                 ...(membership.pauses || []),
                 ...(membership.courseSeason.pauses || []),
               ];
               const { billableDays } = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, allPauses);
               const cycleTotalDays = (currentCycle.cycleEndDate.getTime() - currentCycle.cycleStartDate.getTime()) / MILLISECONDS_IN_DAY;
               
               let finalBillableDays = billableDays;
               if (i === 0 && membership.courseSeason.billingConfig?.prorateFirstRecurringFee === false) {
                  const { billableDays: billableDaysWithoutLateEntry } = calculateBillableDaysWithPauses(currentCycle.cycleStartDate, effectiveEnd, allPauses);
                  finalBillableDays = billableDaysWithoutLateEntry;
               }
               
               // 6. Calcular importe On-Demand
               const { netAmount, baseAmount, adjustmentAmount, discountPercent, appliedDiscounts } = calculateOnDemandCycleFee(
                  membership,
                  currentCycle,
                  finalBillableDays,
                  cycleTotalDays
               );
               
               // Si prorrateó por entrar tarde y no está en la configuración permitida
               // (Esta regla puede refinarse, pero por ahora mostramos lo calculado)

               let description = buildCycleDescription(
                  currentCycle.cycleStartDate,
                  currentCycle.cycleEndDate,
                  billingFrequency
               );
               
               if (finalBillableDays < cycleTotalDays) {
                 description += ` — Prorrateado: ${finalBillableDays} de ${cycleTotalDays} días`;
               }
               description += formatDiscountsDescription(appliedDiscounts);
               
               const shouldChargeCycle = !(i === 0 && !chargeInitialCycle);

               if (!shouldChargeCycle) {
                 charges.push(
                    PreviewChargeFactory.buildRecurringCharge(
                      0,
                      0,
                      buildCycleDescription(currentCycle.cycleStartDate, currentCycle.cycleEndDate, billingFrequency) + ' — Sin cobro / Exonerado',
                      0,
                      0,
                      currentCycle.cycleStartDate,
                      currentCycle.billingYear,
                      currentCycle.billingMonth,
                      billingFrequency === 'MONTHLY' ? null : currentCycle.billingCycle
                    )
                 );
               } else {
                 charges.push(
                    PreviewChargeFactory.buildRecurringCharge(
                      netAmount,
                      baseAmount,
                      description,
                      adjustmentAmount,
                      discountPercent,
                      currentCycle.cycleStartDate, // dueDate es el inicio del ciclo
                      currentCycle.billingYear,
                      currentCycle.billingMonth,
                      billingFrequency === 'MONTHLY' ? null : currentCycle.billingCycle
                    )
                 );
               }
           }
       }
    }

    return { charges, breakdown: this.buildChargesBreakdown(charges) };
  }

  private extractRegistrationCharge(
    membership: StudentMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    chargeRegistration: boolean,
  ): PreviewCharge[] {
    if (
      existingCharges?.some((c) => c.type === TypeMembershipCharge.REGISTRATION)
    )
      return [];

    if (!chargeRegistration) {
       return [
         PreviewChargeFactory.buildRegistrationCharge(
           0,
           0,
           'Matrícula — Exonerada',
           0,
           0,
           membership.startedAt,
         ),
       ];
    }

    const {
      netAmount,
      baseAmount,
      adjustmentAmount,
      discountPercent,
      appliedDiscounts,
    } = calculateRegistrationFee(membership);
    if (!baseAmount || baseAmount <= 0) return [];

    const description =
      'Inscripción' + formatDiscountsDescription(appliedDiscounts);
    return [
      PreviewChargeFactory.buildRegistrationCharge(
        netAmount,
        baseAmount,
        description,
        adjustmentAmount,
        discountPercent,
        membership.startedAt,
      ),
    ];
  }

  private extractSinglePaymentCharge(
    membership: StudentMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    chargeInitialCycle: boolean,
    allCycles: any[],
  ): PreviewCharge[] {
    if (
      existingCharges?.some((c) => c.type === TypeMembershipCharge.SEASON_FEE)
    )
      return [];

    if (!chargeInitialCycle) {
       return [
         PreviewChargeFactory.buildSeasonCharge(
           0,
           0,
           'Ciclo Único — Sin cobro / Exonerado',
           0,
           0,
           membership.startedAt,
         ),
       ];
    }

    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountPercent = 0;

    for (const cycle of allCycles) {
      singlePaymentBaseAmount += cycle.baseAmount || 0;
      singlePaymentDiscountPercent = cycle.discountPercent || 0;
    }

    const singlePayment = calculateSinglePaymentFee(
      membership,
      singlePaymentBaseAmount,
      singlePaymentDiscountPercent,
    );
    if (!singlePayment.hasSinglePaymentAmount) return [];

    return [
      PreviewChargeFactory.buildSeasonCharge(
        singlePayment.netAmount,
        singlePayment.baseAmount,
        singlePayment.description,
        singlePayment.adjustmentAmount,
        singlePayment.discountPercent,
        membership.startedAt,
      ),
    ];
  }

  public buildChargesBreakdown(
    charges: { amount: number; baseAmount?: number; adjustmentAmount?: number }[],
  ) {
    const totalBaseAmount = charges.reduce(
      (sum, c) => sum + (c.baseAmount || 0),
      0,
    );
    const totalDiscountAmount = charges.reduce(
      (sum, c) => sum + (c.adjustmentAmount || 0),
      0,
    );
    const totalNetAmount = charges.reduce((sum, c) => sum + c.amount, 0);

    return {
      totalBaseAmount,
      totalDiscount: totalDiscountAmount,
      totalNetAmount,
      currency: 'BOB',
    };
  }
}
