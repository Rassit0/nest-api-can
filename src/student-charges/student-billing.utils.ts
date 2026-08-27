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

  if (billingFrequency === 'SINGLE') {
    nextDueDate = new Date(seasonEndDate);
    nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 1); // Forzar que sea mayor a seasonEnd para generar 1 solo ciclo
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
  } else if (billingFrequency === 'WEEKLY' || billingFrequency === 'BIWEEKLY') {
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
  return 'Mes - ' + monthName + ' ' + billingYear;
}

export function buildCycleDescription(
  cycleStartDate: Date,
  cycleEndDate: Date,
  billingFrequency: string,
): string {
  const formatter = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' });
  const formatDay = (d: Date) => d.getUTCDate().toString();
  const formatYear = (d: Date) => d.getUTCFullYear().toString();

  // Para visualización inclusiva, restamos 1 milisegundo al endDate
  const visualEndDate = new Date(cycleEndDate.getTime() - 1);
  const startMonthName = formatter.format(cycleStartDate);
  const endMonthName = formatter.format(visualEndDate);
  
  // "Agosto" -> "agosto" o "Agosto"
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (billingFrequency === 'MONTHLY') {
    return capitalize(startMonthName) + ' ' + cycleStartDate.getUTCFullYear();
  }
  
  if (billingFrequency === 'WEEKLY') {
    if (startMonthName === endMonthName) {
      return `Semana del ${formatDay(cycleStartDate)} al ${formatDay(visualEndDate)} de ${startMonthName} de ${formatYear(cycleStartDate)}`;
    } else if (formatYear(cycleStartDate) === formatYear(visualEndDate)) {
      return `Semana del ${formatDay(cycleStartDate)} de ${startMonthName} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(cycleStartDate)}`;
    } else {
      return `Semana del ${formatDay(cycleStartDate)} de ${startMonthName} de ${formatYear(cycleStartDate)} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(visualEndDate)}`;
    }
  }
  
  if (billingFrequency === 'BIWEEKLY') {
    if (startMonthName === endMonthName) {
      return `Quincena del ${formatDay(cycleStartDate)} al ${formatDay(visualEndDate)} de ${startMonthName} de ${formatYear(cycleStartDate)}`;
    } else if (formatYear(cycleStartDate) === formatYear(visualEndDate)) {
      return `Quincena del ${formatDay(cycleStartDate)} de ${startMonthName} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(cycleStartDate)}`;
    } else {
      return `Quincena del ${formatDay(cycleStartDate)} de ${startMonthName} de ${formatYear(cycleStartDate)} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(visualEndDate)}`;
    }
  }
  
  if (billingFrequency === 'SINGLE') {
    if (formatYear(cycleStartDate) === formatYear(visualEndDate)) {
       return `Temporada completa — ${formatDay(cycleStartDate)} de ${startMonthName} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(cycleStartDate)}`;
    }
    return `Temporada completa — ${formatDay(cycleStartDate)} de ${startMonthName} de ${formatYear(cycleStartDate)} al ${formatDay(visualEndDate)} de ${endMonthName} de ${formatYear(visualEndDate)}`;
  }

  return 'Ciclo irregular';
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


export interface AbsoluteCycle {
  cycleCounter: number;
  cycleStartDate: Date;
  cycleEndDate: Date;
  billingYear: number;
  billingMonth: number;
  billingCycle: number;
}

/**
 * Motor absoluto de ciclos (FASE 2.2).
 * Genera bloques estáticos [cycleStartDate, cycleEndDate) partiendo
 * EXCLUSIVAMENTE del startDate de la Season. No depende del estudiante.
 */
export function getAbsoluteSeasonCycles(
  seasonStartDate: Date,
  seasonEndDate: Date,
  billingFrequency: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'SINGLE' | string,
): AbsoluteCycle[] {
  const cycles: AbsoluteCycle[] = [];
  const start = new Date(seasonStartDate);
  const endLimit = new Date(seasonEndDate);

  if (billingFrequency === 'SINGLE') {
    cycles.push({
      cycleCounter: 1,
      cycleStartDate: new Date(start),
      cycleEndDate: new Date(endLimit),
      billingYear: start.getUTCFullYear(),
      billingMonth: start.getUTCMonth() + 1,
      billingCycle: 1,
    });
    return cycles;
  }

  let currentStart: Date;
  if (billingFrequency === 'MONTHLY') {
    currentStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  } else {
    currentStart = new Date(start);
  }

  let cycleCounter = 1;

  while (currentStart < endLimit && cycleCounter <= MAX_BILLING_CYCLES) {
    let nextStart: Date;

    if (billingFrequency === 'WEEKLY') {
      nextStart = new Date(currentStart);
      nextStart.setUTCDate(nextStart.getUTCDate() + 7);
    } else if (billingFrequency === 'BIWEEKLY') {
      nextStart = new Date(currentStart);
      nextStart.setUTCDate(nextStart.getUTCDate() + 14);
    } else {
      // MONTHLY: ancla en el mes calendario real
      nextStart = new Date(Date.UTC(currentStart.getUTCFullYear(), currentStart.getUTCMonth() + 1, 1));
    }

    cycles.push({
      cycleCounter,
      cycleStartDate: new Date(currentStart),
      cycleEndDate: new Date(nextStart),
      billingYear: currentStart.getUTCFullYear(),
      billingMonth: currentStart.getUTCMonth() + 1,
      billingCycle: cycleCounter,
    });

    currentStart = nextStart;
    cycleCounter++;
  }

  return cycles;
}

/**
 * FASE 2.4: Resuelve a qué ciclo absoluto pertenece una fecha de inscripción.
 */
export function findCycleContainingDate(
  cycles: AbsoluteCycle[],
  enrollmentDate: Date,
): AbsoluteCycle | null {
  for (const cycle of cycles) {
    if (enrollmentDate >= cycle.cycleStartDate && enrollmentDate < cycle.cycleEndDate) {
      return cycle;
    }
  }
  return null;
}

/**
 * FASE 2.4: Calcula los límites efectivos de cobro sin modificar la identidad del ciclo.
 */
export function calculateEffectiveBillablePeriod(
  cycle: AbsoluteCycle,
  enrollmentDate: Date,
  seasonEndDate: Date,
): { effectiveStart: Date; effectiveEnd: Date } {
  const effectiveStart = new Date(Math.max(cycle.cycleStartDate.getTime(), enrollmentDate.getTime()));
  const effectiveEnd = new Date(Math.min(cycle.cycleEndDate.getTime(), seasonEndDate.getTime()));
  return { effectiveStart, effectiveEnd };
}

/**
 * FASE 2.5: Calcula los días facturables descontando pausas (si aplica).
 */
export function calculateBillableDaysWithPauses(
  effectiveStart: Date,
  effectiveEnd: Date,
  allPauses: any[] = [],
): { billableDays: number; adjustedEnd: Date; totalDays: number; pauseDays: number } {
  const totalDays = Math.max(0, Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / MILLISECONDS_IN_DAY));
  let pauseDays = 0;
  
  if (allPauses.length > 0) {
    for (const pause of allPauses) {
      if (pause.startDate && pause.endDate) {
        const pStart = new Date(pause.startDate);
        const pEnd = new Date(pause.endDate);
        const overlapStart = new Date(Math.max(pStart.getTime(), effectiveStart.getTime()));
        const overlapEnd = new Date(Math.min(pEnd.getTime(), effectiveEnd.getTime()));
        
        if (overlapStart < overlapEnd) {
          pauseDays += Math.round((overlapEnd.getTime() - overlapStart.getTime()) / MILLISECONDS_IN_DAY);
        }
      }
    }
  }

  const billableDays = Math.max(0, totalDays - pauseDays);
  return { billableDays, adjustedEnd: effectiveEnd, totalDays, pauseDays };
}

/**
 * Resuelve las opciones financieras de inscripción, dando prioridad a las opciones explícitas
 * (chargeRegistration, chargeInitialCycle) y utilizando los campos legacy como fallback.
 */
export function resolveFinancialEnrollmentOptions(
  isMigrated: boolean,
  options?: {
    chargeRegistration?: boolean;
    chargeInitialCycle?: boolean;
    chargeRegistrationOnMigration?: boolean;
    chargeCurrentMonthOnMigration?: boolean;
  } | null
): { chargeRegistration: boolean; chargeInitialCycle: boolean } {
  const chargeRegistration =
    options?.chargeRegistration ??
    (isMigrated ? options?.chargeRegistrationOnMigration : undefined) ??
    true;

  const chargeInitialCycle =
    options?.chargeInitialCycle ??
    (isMigrated ? options?.chargeCurrentMonthOnMigration : undefined) ??
    true;

  return { chargeRegistration, chargeInitialCycle };
}
