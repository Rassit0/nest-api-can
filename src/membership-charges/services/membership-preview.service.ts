import { Injectable } from '@nestjs/common';
import {
  PlayerMembershipWithRelations,
  calculateRegistrationFee,
  calculateSinglePaymentFee,
} from '../membership-financial.calculator';
import { simulateAllCycles, SimulatedCycle } from '../membership-cycles.engine';
import { formatDiscountsDescription } from '../membership-billing.utils';
import { DateUtils } from 'src/utils/date.utils';
import { TypeMembershipCharge } from 'src/generated/prisma/client';
import {
  PreviewCharge,
  ExistingChargeMinimal,
  PreviewResult,
} from '../interfaces/membership-charge.types';
import { PreviewChargeFactory } from '../factories/preview-charge.factory';

@Injectable()
export class MembershipPreviewService {
  public extractPreviewChargesFromCycles(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
  ): PreviewResult {
    let charges: PreviewCharge[] = [];
    const isSeasonFeeOnly =
      membership.teamSeason.billingConfig?.billingType === 'SINGLE_ONLY' ||
      (membership.teamSeason.billingConfig?.billingType === 'BOTH' &&
        membership.paymentPlan?.isSinglePayment === true);
    const isFullPaymentPlan = membership.paymentPlan?.isSinglePayment === true;
    const isMigratedContext =
      existingCharges === null ? membership.isMigrated : membership.isMigrated;
    const allCycles = simulateAllCycles(membership);

    charges = charges.concat(
      this.extractRegistrationCharge(
        membership,
        existingCharges,
        isMigratedContext,
      ),
    );

    if (isSeasonFeeOnly) {
      charges = charges.concat(
        this.extractSinglePaymentCharge(
          membership,
          existingCharges,
          isMigratedContext,
          allCycles,
        ),
      );
    } else {
      charges = charges.concat(
        this.extractRecurringCharges(
          membership,
          existingCharges,
          allCycles,
          isFullPaymentPlan,
          isMigratedContext,
        ),
      );
    }

    return { charges, breakdown: this.buildChargesBreakdown(charges) };
  }

  public extractAdvanceChargesFromCycles(
    cycles: SimulatedCycle[],
  ): PreviewResult {
    const charges = cycles.map((cycle) =>
      PreviewChargeFactory.buildRecurringCharge(
        cycle.netAmount,
        cycle.baseAmount,
        cycle.description,
        cycle.adjustmentAmount,
        cycle.discountPercent,
        cycle.dueDate,
        cycle.billingYear,
        cycle.billingMonth,
        cycle.billingCycle,
      ),
    );

    return { charges, breakdown: this.buildChargesBreakdown(charges) };
  }

  private extractRegistrationCharge(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    isMigratedContext: boolean,
  ): PreviewCharge[] {
    if (
      isMigratedContext &&
      (!existingCharges || existingCharges.length === 0) &&
      !membership.chargeRegistrationOnMigration
    )
      return [];
    if (
      existingCharges?.some((c) => c.type === TypeMembershipCharge.REGISTRATION)
    )
      return [];

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
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    isMigratedContext: boolean,
    allCycles: SimulatedCycle[],
  ): PreviewCharge[] {
    if (isMigratedContext && !membership.chargeCurrentMonthOnMigration)
      return [];
    if (
      existingCharges?.some((c) => c.type === TypeMembershipCharge.SEASON_FEE)
    )
      return [];

    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountPercent = 0;

    for (const cycle of allCycles) {
      singlePaymentBaseAmount += cycle.baseAmount;
      singlePaymentDiscountPercent = cycle.discountPercent;
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

  private extractRecurringCharges(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    allCycles: SimulatedCycle[],
    isFullPaymentPlan: boolean = false,
    isMigratedContext: boolean = false,
  ): PreviewCharge[] {
    const charges: PreviewCharge[] = [];
    const advanceCycles = isFullPaymentPlan
      ? allCycles.length
      : Math.max(1, membership.paymentPlan?.advanceCycles || 1);
    const billingFrequency =
      membership.teamSeason.billingConfig?.billingFrequency || 'MONTHLY';
    let firstDueDate: Date | null = null;

    for (const cycle of allCycles) {
      const hasMonthly =
        existingCharges?.some(
          (c) =>
            c.type === TypeMembershipCharge.RECURRING_FEE &&
            c.billingYear === cycle.billingYear &&
            c.billingMonth === cycle.billingMonth &&
            (billingFrequency === 'MONTHLY'
              ? true
              : c.billingCycle === cycle.billingCycle),
        ) || false;

      let isMigratedCurrentMonth = false;
      if (
        isMigratedContext &&
        membership.chargeCurrentMonthOnMigration === false
      ) {
        const startYear = membership.startedAt.getUTCFullYear();
        const startMonth = membership.startedAt.getUTCMonth() + 1;
        if (
          cycle.billingYear < startYear ||
          (cycle.billingYear === startYear && cycle.billingMonth <= startMonth)
        ) {
          isMigratedCurrentMonth = true;
        }
      }

      if (!hasMonthly && !isMigratedCurrentMonth) {
        if (charges.length === 0 && existingCharges === null) {
          const chargeGenerationDaysBefore =
            membership.teamSeason.billingConfig?.chargeGenerationDaysBefore ||
            7;
          let cycleGenDate = new Date(cycle.dueDate);
          cycleGenDate.setUTCDate(
            cycleGenDate.getUTCDate() - chargeGenerationDaysBefore,
          );

          // Removed cycleGenDate override to allow generation if within the generation window

          const evaluationDate = isFullPaymentPlan 
            ? DateUtils.getEndOfUTCDay(membership.teamSeason.season.endDate) 
            : DateUtils.getEndOfUTCDay(new Date());

          if (cycleGenDate > evaluationDate) {
            break;
          }
        }

        if (!firstDueDate) firstDueDate = cycle.dueDate;

        charges.push(
          PreviewChargeFactory.buildRecurringCharge(
            cycle.netAmount,
            cycle.baseAmount,
            cycle.description,
            cycle.adjustmentAmount,
            cycle.discountPercent,
            existingCharges ? firstDueDate : cycle.dueDate,
            cycle.billingYear,
            cycle.billingMonth,
            cycle.billingCycle,
          ),
        );

        // Only break if we've reached advanceCycles AND the next cycle isn't already due to be generated
        if (charges.length >= advanceCycles && existingCharges === null) {
           const nextCycle = allCycles[allCycles.indexOf(cycle) + 1];
           if (nextCycle) {
              const chargeGenerationDaysBefore = membership.teamSeason.billingConfig?.chargeGenerationDaysBefore || 7;
              let nextCycleGenDate = new Date(nextCycle.dueDate);
              nextCycleGenDate.setUTCDate(nextCycleGenDate.getUTCDate() - chargeGenerationDaysBefore);
              
              const evaluationDate = isFullPaymentPlan 
                ? DateUtils.getEndOfUTCDay(membership.teamSeason.season.endDate) 
                : DateUtils.getEndOfUTCDay(new Date());

              if (nextCycleGenDate > evaluationDate) {
                 break;
              }
           } else {
              break;
           }
        } else if (charges.length >= advanceCycles && existingCharges !== null) {
           break;
        }
      }
    }

    return charges;
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
