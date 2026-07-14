import { Injectable } from '@nestjs/common';
import { PlayerMembershipWithRelations, calculateRegistrationFee, calculateSinglePaymentFee } from '../membership-financial.calculator';
import { simulateAllCycles, SimulatedCycle } from '../membership-cycles.engine';
import { formatDiscountsDescription } from '../membership-billing.utils';
import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { PreviewCharge, ExistingChargeMinimal, PreviewResult } from '../interfaces/membership-charge.types';
import { PreviewChargeFactory } from '../factories/preview-charge.factory';

@Injectable()
export class MembershipPreviewService {
  
  public extractPreviewChargesFromCycles(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null
  ): PreviewResult {
    let charges: PreviewCharge[] = [];
    const isSeasonFeeOnly = membership.teamSeason.billingConfig?.billingType === 'SINGLE_ONLY' || (membership.teamSeason.billingConfig?.billingType === 'BOTH' && membership.paymentPlan?.isSinglePayment === true);
    const isFullPaymentPlan = membership.paymentPlan?.isSinglePayment === true;
    const isMigratedContext = existingCharges === null ? membership.isMigrated : membership.isMigrated;
    const allCycles = (isMigratedContext && (!existingCharges || existingCharges.length === 0)) ? [] : simulateAllCycles(membership);

    charges = charges.concat(this.extractRegistrationCharge(membership, existingCharges, isMigratedContext));

    if (isSeasonFeeOnly) {
      charges = charges.concat(this.extractSinglePaymentCharge(membership, existingCharges, isMigratedContext, allCycles));
    } else {
      charges = charges.concat(this.extractRecurringCharges(membership, existingCharges, allCycles, isFullPaymentPlan));
    }

    return { charges, breakdown: this.buildChargesBreakdown(charges) };
  }

  public extractAdvanceChargesFromCycles(
    cycles: SimulatedCycle[]
  ): PreviewResult {
    const charges = cycles.map(cycle => PreviewChargeFactory.buildRecurringCharge(
      cycle.netAmount,
      cycle.baseAmount,
      cycle.description,
      cycle.discountAmount,
      cycle.discountPercent,
      cycle.dueDate,
      cycle.billingYear,
      cycle.billingMonth,
      cycle.billingCycle
    ));
    
    return { charges, breakdown: this.buildChargesBreakdown(charges) };
  }

  private extractRegistrationCharge(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    isMigratedContext: boolean
  ): PreviewCharge[] {
    if (isMigratedContext && (!existingCharges || existingCharges.length === 0)) return [];
    if (existingCharges?.some(c => c.type === TypeMembershipCharge.REGISTRATION)) return [];

    const { netAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = calculateRegistrationFee(membership);
    if (!baseAmount || baseAmount <= 0) return [];

    const description = 'Inscripción' + formatDiscountsDescription(appliedDiscounts);
    return [PreviewChargeFactory.buildRegistrationCharge(
      netAmount, baseAmount, description, discountAmount, discountPercent, membership.startedAt
    )];
  }

  private extractSinglePaymentCharge(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    isMigratedContext: boolean,
    allCycles: SimulatedCycle[]
  ): PreviewCharge[] {
    if (isMigratedContext) return [];
    if (existingCharges?.some(c => c.type === TypeMembershipCharge.SEASON_FEE)) return [];

    let singlePaymentBaseAmount = 0;
    let singlePaymentDiscountPercent = 0;
    
    for (const cycle of allCycles) {
      singlePaymentBaseAmount += cycle.baseAmount;
      singlePaymentDiscountPercent = cycle.discountPercent;
    }

    const singlePayment = calculateSinglePaymentFee(membership, singlePaymentBaseAmount, singlePaymentDiscountPercent);
    if (!singlePayment.hasSinglePaymentAmount) return [];

    return [PreviewChargeFactory.buildSeasonCharge(
      singlePayment.netAmount, singlePayment.baseAmount, singlePayment.description, singlePayment.discountAmount, singlePayment.discountPercent, membership.startedAt
    )];
  }

  private extractRecurringCharges(
    membership: PlayerMembershipWithRelations,
    existingCharges: ExistingChargeMinimal[] | null,
    allCycles: SimulatedCycle[],
    isFullPaymentPlan: boolean = false
  ): PreviewCharge[] {
    const charges: PreviewCharge[] = [];
    const advanceCycles = isFullPaymentPlan ? allCycles.length : Math.max(1, membership.paymentPlan?.advanceCycles || 1);
    const billingFrequency = membership.teamSeason.billingConfig?.billingFrequency || 'MONTHLY';
    let firstDueDate: Date | null = null;
    
    for (const cycle of allCycles) {
      const hasMonthly = existingCharges?.some(c => 
        c.type === TypeMembershipCharge.RECURRING_FEE && 
        c.billingYear === cycle.billingYear && 
        c.billingMonth === cycle.billingMonth && 
        (billingFrequency === 'MONTHLY' ? true : c.billingCycle === cycle.billingCycle)
      ) || false;

      if (!hasMonthly) {
        if (!firstDueDate) firstDueDate = cycle.dueDate;
        
        charges.push(PreviewChargeFactory.buildRecurringCharge(
          cycle.netAmount,
          cycle.baseAmount,
          cycle.description,
          cycle.discountAmount,
          cycle.discountPercent,
          existingCharges ? (firstDueDate as Date) : cycle.dueDate,
          cycle.billingYear,
          cycle.billingMonth,
          cycle.billingCycle
        ));

        if (charges.length >= advanceCycles) break;
      }
    }
    
    return charges;
  }

  public buildChargesBreakdown(charges: { amount: number; baseAmount?: number; discountAmount?: number }[]) {
    const totalBaseAmount = charges.reduce((sum, c) => sum + (c.baseAmount || 0), 0);
    const totalDiscountAmount = charges.reduce((sum, c) => sum + (c.discountAmount || 0), 0);
    const totalNetAmount = charges.reduce((sum, c) => sum + c.amount, 0);

    return { totalBaseAmount, totalDiscount: totalDiscountAmount, totalNetAmount, currency: 'BOB' };
  }
}
