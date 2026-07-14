import { Prisma } from 'src/generated/prisma/client';
import { MILLISECONDS_IN_DAY } from './membership-billing.utils';

export type PlayerMembershipWithRelations = Prisma.PlayerMembershipGetPayload<{
  include: {
    paymentPlan: true;
    membershipDiscounts: true;
    pauses: true;
    teamSeason: {
      include: {
        season: true;
        billingConfig: true;
        teamSeasonPauses: true;
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
  membership: PlayerMembershipWithRelations,
): FinancialCalculationResult {
  let base = Number(membership.teamSeason.billingConfig?.registrationFee || 0);
  if (membership.teamSeason.billingConfig?.prorateRegistrationFee === true && membership.teamSeason.season) {
    const startDate = new Date(membership.teamSeason.season.startDate);
    const endDate = new Date(membership.teamSeason.season.endDate);
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

  const activeRegDiscounts = (membership.membershipDiscounts || []).filter((d) => {
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
  membership: PlayerMembershipWithRelations,
  dueDate: Date,
  isFirstCycle: boolean = false,
  nextDueDate?: Date,
  seasonEnd?: Date,
  theoreticalDueDate?: Date,
  currentCycleCounter: number = 1
): FinancialCalculationResult {
  let base = Number(membership.teamSeason.billingConfig?.recurringFee || 0);
  let factor = 1;
  let cycleDaysForProrate = 0;
  let activeDaysInCycle = 0;
  let periodStart = dueDate;
  let periodEnd = nextDueDate || new Date(dueDate.getTime() + 30 * MILLISECONDS_IN_DAY);

  if (nextDueDate) {
    cycleDaysForProrate = Math.round((nextDueDate.getTime() - (isFirstCycle && theoreticalDueDate ? theoreticalDueDate.getTime() : dueDate.getTime())) / MILLISECONDS_IN_DAY);
    activeDaysInCycle = cycleDaysForProrate;
    periodEnd = (seasonEnd && nextDueDate > seasonEnd) ? seasonEnd : nextDueDate;
  }

  if (isFirstCycle && nextDueDate && theoreticalDueDate) {
    if (membership.teamSeason.billingConfig?.prorateFirstRecurringFee === true) {
      const activeDays = Math.round((periodEnd.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY);
      activeDaysInCycle = activeDays;
      periodStart = membership.startedAt > theoreticalDueDate ? membership.startedAt : theoreticalDueDate;
    }
  } else if (nextDueDate && seasonEnd && nextDueDate > seasonEnd) {
    if (membership.teamSeason.billingConfig?.prorateLastRecurringFee === true) {
      const activeDays = Math.round((seasonEnd.getTime() - dueDate.getTime()) / MILLISECONDS_IN_DAY);
      activeDaysInCycle = activeDays;
    }
  }

  // Restar días de pausas (vacaciones/suspensiones)
  let pauseDays = 0;
  const allPauses = [
    ...(membership.pauses || []),
    ...(membership.teamSeason.teamSeasonPauses || []),
  ];

  if (allPauses.length > 0) {
    const intervals = allPauses
      .map((p) => ({
        start: Math.max(p.startDate.getTime(), periodStart.getTime()),
        end: Math.min(p.endDate.getTime(), periodEnd.getTime()),
      }))
      .filter((i) => i.start < i.end);

    if (intervals.length > 0) {
      intervals.sort((a, b) => a.start - b.start);
      const merged = [intervals[0]];
      for (let i = 1; i < intervals.length; i++) {
        const current = intervals[i];
        const last = merged[merged.length - 1];
        if (current.start <= last.end) {
          last.end = Math.max(last.end, current.end);
        } else {
          merged.push(current);
        }
      }

      for (const m of merged) {
        pauseDays += Math.round((m.end - m.start) / MILLISECONDS_IN_DAY);
      }
    }
  }

  if (cycleDaysForProrate > 0) {
    activeDaysInCycle = Math.max(0, activeDaysInCycle - pauseDays);
    factor = Math.max(0, activeDaysInCycle / cycleDaysForProrate);
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
  }

  const activeRecDiscounts = (membership.membershipDiscounts || []).filter((d) => {
    const evalDate = dueDate < membership.startedAt ? membership.startedAt : dueDate;
    return d.startDate <= evalDate && (!d.endDate || d.endDate >= evalDate);
  });

  for (const d of activeRecDiscounts) {
    const p = Number(d.recurringDiscountPercent || 0);
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

export function calculateSinglePaymentFee(
  membership: PlayerMembershipWithRelations,
  accumulatedBaseAmount: number,
  accumulatedDiscountPercent: number,
): FinancialCalculationResult & { description: string; hasSinglePaymentAmount: boolean } {
  const teamSeason = membership.teamSeason;
  const paymentPlan = membership.paymentPlan;

  let baseAmount = accumulatedBaseAmount;
  let discountPercent = accumulatedDiscountPercent;

  let factor = 1;
  let totalDays = 0;
  let activeDays = 0;

  const hasSinglePaymentAmount = baseAmount > 0 || Number(teamSeason.billingConfig?.seasonFee || 0) > 0;

  if (teamSeason.billingConfig?.seasonFee) {
    baseAmount = Number(teamSeason.billingConfig.seasonFee);
    if (teamSeason.billingConfig.prorateSeasonFee === true && teamSeason.season) {
      const startDate = new Date(teamSeason.season.startDate);
      const endDate = new Date(teamSeason.season.endDate);
      totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MILLISECONDS_IN_DAY));
      activeDays = Math.max(0, Math.round((endDate.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY));
      factor = Math.min(1, activeDays / totalDays);
      baseAmount = baseAmount * factor;
    }
    discountPercent = Number(paymentPlan?.seasonFeeDiscountPercent || 0);
  }

  const appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[] = [];
  if (discountPercent > 0) {
    appliedDiscounts.push({ percent: discountPercent, reason: 'Plan de pago' });
  }

  if (teamSeason.billingConfig?.seasonFee) {
    const activeSeasonDiscounts = (membership.membershipDiscounts || []).filter((d) => {
      return d.startDate <= membership.startedAt && (!d.endDate || d.endDate >= membership.startedAt);
    });

    for (const d of activeSeasonDiscounts) {
      const p = Number(d.seasonFeeDiscountPercent || 0);
      if (p > 0) {
        appliedDiscounts.push({ percent: p, reason: d.reason || d.type, endDate: d.endDate });
        discountPercent += p;
      }
    }
    discountPercent = Math.min(100, discountPercent);
  }

  let discountAmount = Number(((baseAmount * discountPercent) / 100).toFixed(2));
  let netAmount = Number(Math.max(0, baseAmount - discountAmount).toFixed(2));

  let description = 'Pago Completo - Temporada';
  if (factor < 1) {
    description += ` (Prorrateado: cubre ${activeDays} de ${totalDays} días)`;
  }
  if (appliedDiscounts.length > 0) {
    const { formatDiscountsDescription } = require('./membership-billing.utils');
    description += formatDiscountsDescription(appliedDiscounts);
  }

  return {
    baseAmount: Number(baseAmount.toFixed(2)),
    discountPercent: Number(discountPercent.toFixed(2)),
    discountAmount,
    netAmount,
    appliedDiscounts,
    description,
    hasSinglePaymentAmount
  };
}
