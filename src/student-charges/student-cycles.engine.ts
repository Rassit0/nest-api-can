import {
  StudentMembershipWithRelations,
  calculateRecurringFeeForDate,
} from './student-financial.calculator';
import {
  calculateCycleDates,
  buildCycleDescription,
  formatDiscountsDescription,
  MAX_BILLING_CYCLES,
} from 'src/membership-charges/membership-billing.utils';

export interface SimulatedCycle {
  cycleCounter: number;
  dueDate: Date;
  theoreticalDueDate: Date;
  nextDueDate: Date;
  billingYear: number;
  billingMonth: number;
  billingCycle: number;
  description: string;
  amount: number;
  baseAmount: number;
  discountAmount: number;
  discountPercent: number;
  netAmount: number;
  appliedDiscounts: { percent: number; reason?: string; endDate?: Date | null }[];
}

/**
 * El Motor de Generación de Ciclos de Escuelas
 * Proyecta matemáticamente todas las cuotas de un estudiante desde el inicio
 * hasta el final de la temporada, aplicando prorrateos y descuentos, sin guardar
 * nada en base de datos.
 */
export function simulateAllCycles(membership: StudentMembershipWithRelations): SimulatedCycle[] {
  const allCycles: SimulatedCycle[] = [];
  const seasonEnd = new Date(membership.courseSeason.season.endDate);
  seasonEnd.setUTCHours(23, 59, 59, 999);
  const billingDay = Number(membership.courseSeason.billingConfig?.billingDay || 1);
  const billingFrequency = membership.courseSeason.billingConfig?.billingFrequency || 'MONTHLY';

  let cycleCounter = 1;

  while (cycleCounter <= MAX_BILLING_CYCLES) {
    const { dueDate, theoreticalDueDate, nextDueDate, billingYear, billingMonth, billingCycle } = calculateCycleDates(
      membership.startedAt,
      seasonEnd,
      billingDay,
      billingFrequency,
      cycleCounter,
    );

    const isFirstCycle = cycleCounter === 1;

    let description = buildCycleDescription(
      membership.startedAt,
      billingFrequency,
      billingYear,
      billingMonth,
      billingCycle,
    );

    if (isFirstCycle && nextDueDate) {
      const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / (1000 * 60 * 60 * 24));
      const activeDays = Math.max(0, Math.round((nextDueDate.getTime() - membership.startedAt.getTime()) / (1000 * 60 * 60 * 24)));
      if (activeDays > 0 && activeDays !== cycleDays) {
        description += ` (Prorrateado: cubre ${activeDays} de ${cycleDays} días)`;
      }
    }

    if (nextDueDate > seasonEnd) {
      const cycleDays = Math.round((nextDueDate.getTime() - theoreticalDueDate.getTime()) / (1000 * 60 * 60 * 24));
      const activeDays = Math.max(0, Math.round((seasonEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (activeDays > 0 && activeDays !== cycleDays) {
        description += ` (Prorrateo de salida: cubre ${activeDays} de ${cycleDays} días)`;
      }
    }

    const {
      netAmount,
      baseAmount,
      discountAmount,
      discountPercent,
      appliedDiscounts,
    } = calculateRecurringFeeForDate(
      membership,
      dueDate,
      isFirstCycle,
      nextDueDate,
      seasonEnd,
      theoreticalDueDate,
      cycleCounter,
    );

    description += formatDiscountsDescription(appliedDiscounts);

    allCycles.push({
      cycleCounter,
      dueDate,
      theoreticalDueDate,
      nextDueDate,
      billingYear,
      billingMonth,
      billingCycle,
      description,
      amount: netAmount,
      baseAmount,
      discountAmount,
      discountPercent,
      netAmount,
      appliedDiscounts,
    });

    if (nextDueDate > seasonEnd) {
      break;
    }
    cycleCounter++;
  }

  return allCycles;
}
