import { Prisma } from 'src/generated/prisma/client';
import { MILLISECONDS_IN_DAY } from 'src/membership-charges/membership-billing.utils';

export type StudentMembershipWithRelations = Prisma.StudentMembershipGetPayload<{
  include: {
    paymentPlan: true;
    studentDiscounts: true;
    courseSeason: {
      include: {
        season: true;
      };
    };
  };
}>;

export interface FinancialCalculationResult {
  baseAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[];
}

export function calculateRegistrationFee(
  membership: StudentMembershipWithRelations,
): FinancialCalculationResult {
  let base = Number(membership.courseSeason.registrationFee || 0);
  if (membership.courseSeason.prorateRegistrationFee && membership.courseSeason.season) {
    const startDate = new Date(membership.courseSeason.season.startDate);
    const endDate = new Date(membership.courseSeason.season.endDate);
    const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MILLISECONDS_IN_DAY));
    const activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY));
    const factor = Math.min(1, activeDays / totalDays);
    base = base * factor;
  }

  const appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] = [];
  const ppRegDiscount = Number(membership.paymentPlan?.registrationDiscountPercent || 0);
  if (ppRegDiscount > 0) {
    appliedDiscounts.push({ percent: ppRegDiscount, reason: 'Plan de pago' });
  }

  const activeRegDiscounts = (membership.studentDiscounts || []).filter((d) => {
    const date = membership.startedAt;
    return d.startDate <= date && (!d.endDate || d.endDate >= date);
  });

  for (const d of activeRegDiscounts) {
    const p = Number(d.registrationDiscountPercent || 0);
    if (p > 0) {
      appliedDiscounts.push({ percent: p, reason: d.reason || d.type, endDate: d.endDate });
    }
  }

  const discount = Math.min(100, appliedDiscounts.reduce((sum, d) => sum + d.percent, 0));

  let discountAmount = (base * discount) / 100;
  discountAmount = Number(discountAmount.toFixed(2));
  let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));
  
  return { baseAmount: Number(base.toFixed(2)), discountPercent: Number(discount.toFixed(2)), discountAmount, netAmount, appliedDiscounts };
}

export function calculateRecurringFeeForDate(
  membership: StudentMembershipWithRelations,
  dueDate: Date,
  isFirstCycle: boolean = false,
  nextDueDate?: Date,
  seasonEnd?: Date,
  theoreticalDueDate?: Date,
  currentCycleCounter: number = 1
): FinancialCalculationResult {
  let base = Number(membership.courseSeason.recurringFee || 0);
  let factor = 1;
  
  if (isFirstCycle && nextDueDate && theoreticalDueDate) {
    if (membership.courseSeason.prorateFirstRecurringFee !== false) {
      const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / MILLISECONDS_IN_DAY);
      const activeDays = Math.round((nextDueDate.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY);
      factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
    }
  } else if (nextDueDate && seasonEnd && nextDueDate > seasonEnd) {
    if (membership.courseSeason.prorateLastRecurringFee !== false) {
      const cycleDays = Math.round((nextDueDate.getTime() - dueDate.getTime()) / MILLISECONDS_IN_DAY);
      const activeDays = Math.round((seasonEnd.getTime() - dueDate.getTime()) / MILLISECONDS_IN_DAY);
      factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
    }
  }
  
  base = base * factor;

  const appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] = [];
  
  const advanceCycles = Math.max(1, membership.paymentPlan?.advanceCycles || 1);
  const advanceDiscount = Number(membership.paymentPlan?.advanceCyclesDiscountPercent || 0);

  if (currentCycleCounter <= advanceCycles && advanceDiscount > 0) {
    appliedDiscounts.push({ percent: advanceDiscount, reason: 'Descuento Pago Adelantado' });
  } else {
    const ppRecDiscount = Number(membership.paymentPlan?.recurringDiscountPercent || 0);
    if (ppRecDiscount > 0) {
      appliedDiscounts.push({ percent: ppRecDiscount, reason: 'Plan de pago' });
    }

    const activeRecDiscounts = (membership.studentDiscounts || []).filter((d) => {
      const evalDate = dueDate < membership.startedAt ? membership.startedAt : dueDate;
      return d.startDate <= evalDate && (!d.endDate || d.endDate >= evalDate);
    });

    for (const d of activeRecDiscounts) {
      const p = Number(d.recurringDiscountPercent || 0);
      if (p > 0) {
        appliedDiscounts.push({ percent: p, reason: d.reason || d.type, endDate: d.endDate });
      }
    }
  }

  const discount = Math.min(100, appliedDiscounts.reduce((sum, d) => sum + d.percent, 0));

  let discountAmount = (base * discount) / 100;
  discountAmount = Number(discountAmount.toFixed(2));
  let netAmount = Number(Math.max(0, base - discountAmount).toFixed(2));
  
  return { baseAmount: Number(base.toFixed(2)), discountPercent: Number(discount.toFixed(2)), discountAmount, netAmount, appliedDiscounts };
}

export function calculateSinglePaymentFee(
  membership: StudentMembershipWithRelations,
  accumulatedBaseAmount: number,
  accumulatedDiscountPercent: number
): {
  description: string;
  hasSinglePaymentAmount: boolean;
  baseAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
} {
  let singlePaymentBaseAmount = accumulatedBaseAmount;
  let singlePaymentDiscountPercent = accumulatedDiscountPercent;

  if (membership.courseSeason.seasonFee) {
    singlePaymentBaseAmount = Number(membership.courseSeason.seasonFee);
    if (membership.courseSeason.prorateSeasonFee && membership.courseSeason.season) {
      const startDate = new Date(membership.courseSeason.season.startDate);
      const endDate = new Date(membership.courseSeason.season.endDate);
      const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MILLISECONDS_IN_DAY));
      const activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY));
      const factor = Math.min(1, activeDays / totalDays);
      singlePaymentBaseAmount = singlePaymentBaseAmount * factor;
    }
    singlePaymentDiscountPercent = Number(membership.paymentPlan.seasonFeeDiscountPercent || 0);
  }

  const hasSinglePaymentAmount = singlePaymentBaseAmount > 0 || Number(membership.courseSeason.seasonFee || 0) > 0;
  const singlePaymentDiscountAmount = Number(((singlePaymentBaseAmount * singlePaymentDiscountPercent) / 100).toFixed(2));
  const singlePaymentTotalAmount = Number(Math.max(0, singlePaymentBaseAmount - singlePaymentDiscountAmount).toFixed(2));

  let seasonFeeDesc = 'Pago Completo - Temporada';
  if (singlePaymentDiscountPercent > 0) {
    seasonFeeDesc += ` (Descuento de ${singlePaymentDiscountPercent}% - Plan de pago)`;
  }

  return {
    hasSinglePaymentAmount,
    description: seasonFeeDesc,
    baseAmount: singlePaymentBaseAmount,
    discountPercent: singlePaymentDiscountPercent,
    discountAmount: singlePaymentDiscountAmount,
    netAmount: singlePaymentTotalAmount,
  };
}
