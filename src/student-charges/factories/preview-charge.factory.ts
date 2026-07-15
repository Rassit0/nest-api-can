import { TypeMembershipCharge , StatusCourseSeason } from 'src/generated/prisma/client';
import { PreviewCharge } from '../interfaces/student-charge.types';

export class PreviewChargeFactory {
  static buildRegistrationCharge(
    amount: number,
    baseAmount: number,
    description: string,
    discountAmount: number,
    discountPercent: number,
    dueDate: Date
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.REGISTRATION,
      description,
      amount,
      baseAmount,
      discountAmount,
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
    discountAmount: number,
    discountPercent: number,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.RECURRING_FEE,
      description,
      amount,
      baseAmount,
      discountAmount,
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
    discountAmount: number,
    discountPercent: number,
    dueDate: Date
  ): PreviewCharge {
    return {
      type: TypeMembershipCharge.SEASON_FEE,
      description,
      amount,
      baseAmount,
      discountAmount,
      discountPercent,
      dueDate,
      billingYear: dueDate.getUTCFullYear(),
      billingMonth: dueDate.getUTCMonth() + 1,
    };
  }
}

