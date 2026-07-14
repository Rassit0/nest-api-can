import { PlayerMembershipWithRelations, calculateRecurringFeeForDate } from './membership-financial.calculator';
import { calculateCycleDates, buildCycleDescription, formatDiscountsDescription } from './membership-billing.utils';

export interface SimulatedCycle {
  cycleCounter: number;
  dueDate: Date;
  theoreticalDueDate: Date;
  nextDueDate: Date;
  billingYear: number;
  billingMonth: number;
  billingCycle: number | null;
  isFirstCycle: boolean;
  baseAmount: number;
  discountAmount: number;
  discountPercent: number;
  netAmount: number;
  appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[];
  description: string;
}

const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;
const MAX_BILLING_CYCLES = 60; // Safe upper bound for cycle generation loop

export function simulateAllCycles(membership: PlayerMembershipWithRelations): SimulatedCycle[] {
  const seasonEnd = new Date(membership.teamSeason.season.endDate);
  seasonEnd.setUTCHours(23, 59, 59, 999);
  const billingDay = Number(membership.teamSeason.billingConfig?.billingDay || 1);
  const billingFrequency = membership.teamSeason.billingConfig?.billingFrequency || 'MONTHLY';
  const isSinglePayment = membership.paymentPlan?.isSinglePayment || membership.teamSeason.billingConfig?.billingType === 'SINGLE_ONLY';
  
  const cycles: SimulatedCycle[] = [];
  let cycleCounter = 1;
  let keepGenerating = true;

  while (keepGenerating && cycleCounter < MAX_BILLING_CYCLES) {
    const { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle } = calculateCycleDates(
      membership.startedAt, seasonEnd, billingDay, billingFrequency, cycleCounter
    );
    
    const isFirstCycle = cycleCounter === 1;
    let description = buildCycleDescription(membership.startedAt, billingFrequency, billingYear, billingMonth, billingCycle);

    if (isFirstCycle && nextDueDate && membership.teamSeason.billingConfig?.prorateFirstRecurringFee === true) {
      const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / MILLISECONDS_IN_DAY);
      const periodEnd = nextDueDate > seasonEnd ? seasonEnd : nextDueDate;
      const activeDays = Math.max(0, Math.round((periodEnd.getTime() - membership.startedAt.getTime()) / MILLISECONDS_IN_DAY));
      if (activeDays > 0 && activeDays !== cycleDays) {
        description += ' (Prorrateado: cubre ' + activeDays + ' de ' + cycleDays + ' días)';
      }
    }

    if (nextDueDate && nextDueDate > seasonEnd && membership.teamSeason.billingConfig?.prorateLastRecurringFee === true) {
      const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / MILLISECONDS_IN_DAY);
      const activeDays = Math.max(0, Math.round((seasonEnd.getTime() - dueDate.getTime()) / MILLISECONDS_IN_DAY));
      if (activeDays > 0 && activeDays !== cycleDays) {
          description += ' (Prorrateo de salida: cubre ' + activeDays + ' de ' + cycleDays + ' días)';
      }
    }

    const { netAmount, baseAmount, discountAmount, discountPercent, appliedDiscounts } = calculateRecurringFeeForDate(
      membership, dueDate, isFirstCycle, nextDueDate, seasonEnd, theoreticalDueDate, cycleCounter
    );

    description += formatDiscountsDescription(appliedDiscounts);

    cycles.push({
      cycleCounter,
      dueDate,
      theoreticalDueDate,
      nextDueDate,
      billingYear,
      billingMonth,
      billingCycle,
      isFirstCycle,
      baseAmount: baseAmount || 0,
      discountAmount: discountAmount || 0,
      discountPercent: discountPercent || 0,
      netAmount,
      appliedDiscounts,
      description
    });

    if (nextDueDate > seasonEnd) {
      keepGenerating = false;
      break;
    }
    cycleCounter++;
  }

  return cycles;
}
