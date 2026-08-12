import { DateUtils } from 'src/utils/date.utils';

export const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;
export const MAX_BILLING_CYCLES = 120;

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function calculateCycleDates(
  startDate: Date,
  seasonEndDate: Date,
  billingDay: number,
  billingFrequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'SINGLE' | string,
  cycleCounter: number,
) {
  let dueDate = new Date(startDate);
  let nextDueDate = new Date(startDate);
  let theoreticalDueDate = new Date(startDate);

  if (billingFrequency === 'WEEKLY' || billingFrequency === 'BIWEEKLY') {
    const daysToAdd = billingFrequency === 'WEEKLY' ? 7 : 14;
    dueDate.setUTCDate(dueDate.getUTCDate() + (cycleCounter - 1) * daysToAdd);
    theoreticalDueDate = new Date(dueDate);
    nextDueDate.setUTCDate(dueDate.getUTCDate() + daysToAdd);
    const billingYear = theoreticalDueDate.getUTCFullYear();
    const billingMonth = theoreticalDueDate.getUTCMonth() + 1;
    return {
      dueDate: DateUtils.getEndOfLocalDayInUTC(dueDate),
      theoreticalDueDate: DateUtils.getEndOfLocalDayInUTC(theoreticalDueDate),
      nextDueDate: DateUtils.getEndOfLocalDayInUTC(nextDueDate),
      billingYear,
      billingMonth,
      billingCycle: cycleCounter,
    };
  } else if (billingFrequency === 'SINGLE') {
    dueDate = new Date(startDate);
    theoreticalDueDate = new Date(startDate);
    nextDueDate = new Date(seasonEndDate);
    const billingYear = theoreticalDueDate.getUTCFullYear();
    const billingMonth = theoreticalDueDate.getUTCMonth() + 1;
    return {
      dueDate: DateUtils.getEndOfLocalDayInUTC(dueDate),
      theoreticalDueDate: DateUtils.getEndOfLocalDayInUTC(theoreticalDueDate),
      nextDueDate: DateUtils.getEndOfLocalDayInUTC(nextDueDate),
      billingYear,
      billingMonth,
      billingCycle: cycleCounter,
    };
  } else {
    let currentBillingYear = startDate.getUTCFullYear();
    let currentBillingMonth = startDate.getUTCMonth();
    const maxDaysInStartMonth = new Date(
      Date.UTC(currentBillingYear, currentBillingMonth + 1, 0),
    ).getUTCDate();
    const safeStartBillingDay = Math.min(billingDay, maxDaysInStartMonth);
    const thisMonthBillingDate = new Date(
      Date.UTC(currentBillingYear, currentBillingMonth, safeStartBillingDay),
    );

    // Restore logic that shifts the first billing cycle to the previous month
    // if the start date is before the billing day of the current month.
    if (startDate.getUTCDate() < safeStartBillingDay) {
      currentBillingMonth -= 1;
      if (currentBillingMonth < 0) {
        currentBillingMonth = 11;
        currentBillingYear -= 1;
      }
    }

    let targetMonth = currentBillingMonth + (cycleCounter - 1);
    let targetYear = currentBillingYear;
    while (targetMonth > 11) {
      targetMonth -= 12;
      targetYear += 1;
    }

    const maxDaysInTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();
    const safeTargetBillingDay = Math.min(billingDay, maxDaysInTargetMonth);
    theoreticalDueDate = new Date(
      Date.UTC(targetYear, targetMonth, safeTargetBillingDay),
    );

    let nextTargetMonth = targetMonth + 1;
    let nextTargetYear = targetYear;
    if (nextTargetMonth > 11) {
      nextTargetMonth = 0;
      nextTargetYear += 1;
    }

    const maxDaysInNextMonth = new Date(
      Date.UTC(nextTargetYear, nextTargetMonth + 1, 0),
    ).getUTCDate();
    const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
    nextDueDate = new Date(
      Date.UTC(nextTargetYear, nextTargetMonth, safeNextBillingDay),
    );

    dueDate = new Date(theoreticalDueDate);
    if (cycleCounter === 1) {
      dueDate = new Date(startDate);
    }

    const billingYear = theoreticalDueDate.getUTCFullYear();
    const billingMonthNum = theoreticalDueDate.getUTCMonth() + 1;

    return {
      dueDate: DateUtils.getEndOfLocalDayInUTC(dueDate),
      theoreticalDueDate: DateUtils.getEndOfLocalDayInUTC(theoreticalDueDate),
      nextDueDate: DateUtils.getEndOfLocalDayInUTC(nextDueDate),
      billingYear,
      billingMonth: billingMonthNum,
      billingCycle: cycleCounter,
    };
  }
}

export function buildRecurringDescription(
  startedAt: Date,
  billingYear: number,
  billingMonth: number,
  monthName: string,
): string {
  const isEnrollmentMonth =
    billingYear === startedAt.getUTCFullYear() &&
    billingMonth - 1 === startedAt.getUTCMonth();
  if (isEnrollmentMonth) {
    return 'Primer Mes - ' + monthName + ' ' + billingYear;
  }
  return 'Mes - ' + monthName + ' ' + billingYear;
}

export function buildCycleDescription(
  startedAt: Date,
  billingFrequency: string,
  billingYear: number,
  billingMonth: number,
  billingCycle: number,
): string {
  const capitalizedMonthName = MONTH_NAMES[billingMonth - 1];
  if (billingFrequency === 'SINGLE') {
    return 'Cuota Única - Temporada Completa';
  }
  if (billingFrequency === 'WEEKLY') {
    return (
      'Semana ' +
      billingCycle +
      ' - ' +
      capitalizedMonthName +
      ' ' +
      billingYear
    );
  }
  if (billingFrequency === 'BIWEEKLY') {
    return (
      'Quincena ' +
      billingCycle +
      ' - ' +
      capitalizedMonthName +
      ' ' +
      billingYear
    );
  }
  return buildRecurringDescription(
    startedAt,
    billingYear,
    billingMonth,
    capitalizedMonthName,
  );
}

const DISCOUNT_TYPE_TRANSLATIONS: Record<string, string> = {
  SCHOLARSHIP: 'Beca',
  SPECIAL_DISCOUNT: 'Descuento especial',
  FINANCIAL_AID: 'Ayuda económica',
  AGREEMENT: 'Convenio',
  EXEMPTION: 'Exoneración',
  OTHER: 'Otro',
};

export function formatDiscountsDescription(
  appliedDiscounts: {
    percent: number;
    reason?: string;
    endDate?: Date | null;
  }[],
): string {
  if (appliedDiscounts.length === 0) return '';
  const descParts = appliedDiscounts.map((d) => {
    let text = '-' + d.percent + '%';
    if (d.reason) {
      const translatedReason = DISCOUNT_TYPE_TRANSLATIONS[d.reason] || d.reason;
      text += ' ' + translatedReason;
    }
    if (d.endDate) {
      text +=
        ' hasta el ' +
        d.endDate.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'UTC',
        });
    }
    return text;
  });
  return ' (' + descParts.join(', ') + ')';
}

export function extractDiscountReason(
  appliedDiscounts: {
    percent: number;
    reason?: string;
  }[],
): string | null {
  if (appliedDiscounts.length === 0) return null;
  const reasons = appliedDiscounts
    .map((d) => (d.reason ? DISCOUNT_TYPE_TRANSLATIONS[d.reason] || d.reason : 'Plan de pago'))
    .filter(Boolean);
  return reasons.length > 0 ? reasons.join(', ') : null;
}
