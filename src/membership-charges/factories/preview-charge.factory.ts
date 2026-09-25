import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { PreviewCharge } from '../interfaces/membership-charge.types';

export class PreviewChargeFactory {
  static buildRegistrationCharge(
    amount: number,
    baseAmount: number,
    description: string,
    adjustmentAmount: number,
    discountPercent: number,
    dueDate: Date,
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.REGISTRATION,
      description,
      amount,
      baseAmount,
      adjustmentAmount,
      discountPercent,
      dueDate,
      billingYear: dueDate.getUTCFullYear(),
      billingMonth: dueDate.getUTCMonth() + 1,
    };
  }

  static buildRecurringCharge(
    amount: number,
    baseAmount: number,
    description: string,
    adjustmentAmount: number,
    discountPercent: number,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null,
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.RECURRING_FEE,
      description,
      amount,
      baseAmount,
      adjustmentAmount,
      discountPercent,
      dueDate,
      billingYear,
      billingMonth,
      billingCycle,
    };
  }

  static buildSeasonCharge(
    amount: number,
    baseAmount: number,
    description: string,
    adjustmentAmount: number,
    discountPercent: number,
    dueDate: Date,
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.SEASON_FEE,
      description,
      amount,
      baseAmount,
      adjustmentAmount,
      discountPercent,
      dueDate,
      billingYear: dueDate.getUTCFullYear(),
      billingMonth: dueDate.getUTCMonth() + 1,
    };
  }

  static buildLateFeeCharge(
    amount: number,
    description: string,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    parentChargeType: TypeMembershipCharge,
    billingCycle?: number | null,
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.LATE_FEE,
      description,
      amount,
      baseAmount: 0,
      adjustmentAmount: 0,
      discountPercent: 0,
      dueDate,
      billingYear,
      billingMonth,
      billingCycle,
      parentChargeType,
    };
  }
}
