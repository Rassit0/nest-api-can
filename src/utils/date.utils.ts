import { envs } from '../config/envs';

export class DateUtils {
  static getEndOfUTCDay(date: Date | string | null = new Date()): Date {
    if (!date) return new Date();
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return end;
  }

  // Retorna el equivalente en UTC a las 23:59:59.999 de la zona horaria indicada
  static getEndOfLocalDayInUTC(
    date: Date | string | null = new Date(),
  ): Date {
    if (!date) return new Date();
    
    const d = new Date(date);

    // Formatear la fecha en la zona horaria destino (ej: America/La_Paz) para obtener el año, mes y día LOCAL
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: envs.appTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(d);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find((p) => p.type === 'day')!.value);
    
    // Calculamos el offset dinámicamente usando la zona horaria configurada
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: envs.appTimezone }));
    const finalOffset = Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60));

    // Creamos un Date en UTC seteado al final de ese día local exacto
    const endOfDayUTC = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    
    // Le restamos el offset (ej: -(-4) = +4 horas)
    endOfDayUTC.setUTCHours(endOfDayUTC.getUTCHours() - finalOffset);
    
    return endOfDayUTC;
  }

  /**
   * Constructs the end of a local calendar day (23:59:59.999) in the application's timezone
   * and returns the exact UTC instant that represents it.
   *
   * @param year - The calendar year
   * @param month - The calendar month (0-11)
   * @param day - The calendar day of the month
   */
  static getEndOfLocalDayFromParts(year: number, month: number, day: number): Date {
    const tz = envs.appTimezone;
    
    // First approximation of UTC time using 12:00 UTC as reference for the target day.
    // Noon UTC is generally safe for finding the timezone offset as it avoids midnight boundaries.
    const probe1 = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    
    const getOffsetMs = (d: Date) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(d);
      
      const localYear = parseInt(parts.find(p => p.type === 'year')!.value);
      const localMonth = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
      const localDay = parseInt(parts.find(p => p.type === 'day')!.value);
      let localHour = parseInt(parts.find(p => p.type === 'hour')!.value);
      if (localHour === 24) localHour = 0;
      const localMinute = parseInt(parts.find(p => p.type === 'minute')!.value);
      const localSecond = parseInt(parts.find(p => p.type === 'second')!.value);
      
      const localAsUTC = new Date(Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond, d.getUTCMilliseconds()));
      return localAsUTC.getTime() - d.getTime();
    };
    
    const offset1 = getOffsetMs(probe1);
    
    // We want the local time to be exactly 23:59:59.999 on the specified calendar day
    const targetLocalAsUTC = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    
    // Subtract our first offset guess to get a close estimate of the actual UTC time
    const estimatedUTC = new Date(targetLocalAsUTC.getTime() - offset1);
    
    // Probe the offset again at our estimated UTC time.
    // Since estimatedUTC represents the exact target local time, its offset is the definitive one
    // (this is critical for accurately handling DST transitions that might happen during the day).
    const offset2 = getOffsetMs(estimatedUTC);
    
    // Return final UTC time using the definitive offset
    return new Date(targetLocalAsUTC.getTime() - offset2);
  }

  static getStartOfUTCDay(date: Date | string | null = new Date()): Date {
    if (!date) return new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  // Retorna el equivalente en UTC a las 00:00:00.000 de la zona horaria indicada
  static getStartOfLocalDayInUTC(
    date: Date | string | null = new Date(),
  ): Date {
    if (!date) return new Date();
    
    const d = new Date(date);

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: envs.appTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(d);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
    const day = parseInt(parts.find((p) => p.type === 'day')!.value);
    
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: envs.appTimezone }));
    const finalOffset = Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60));

    const startOfDayUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    startOfDayUTC.setUTCHours(startOfDayUTC.getUTCHours() - finalOffset);
    
    return startOfDayUTC;
  }

  /**
   * Constructs the start of a local calendar day (00:00:00.000) in the application's timezone (envs.appTimezone)
   * and returns the exact UTC instant that represents it.
   *
   * @param year - The calendar year
   * @param month - The calendar month (0-11)
   * @param day - The calendar day of the month
   */
  static getStartOfLocalDayFromParts(year: number, month: number, day: number): Date {
    const tz = envs.appTimezone;

    // First approximation of UTC time using 12:00 UTC as reference for the target day.
    const probe1 = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));

    const getOffsetMs = (d: Date) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(d);

      const localYear = parseInt(parts.find((p) => p.type === 'year')!.value);
      const localMonth = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
      const localDay = parseInt(parts.find((p) => p.type === 'day')!.value);
      let localHour = parseInt(parts.find((p) => p.type === 'hour')!.value);
      if (localHour === 24) localHour = 0;
      const localMinute = parseInt(parts.find((p) => p.type === 'minute')!.value);
      const localSecond = parseInt(parts.find((p) => p.type === 'second')!.value);

      const localAsUTC = new Date(
        Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond, d.getUTCMilliseconds()),
      );
      return localAsUTC.getTime() - d.getTime();
    };

    const offset1 = getOffsetMs(probe1);

    // Target local time: 00:00:00.000
    const targetLocalAsUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const estimatedUTC = new Date(targetLocalAsUTC.getTime() - offset1);
    const offset2 = getOffsetMs(estimatedUTC);

    return new Date(targetLocalAsUTC.getTime() - offset2);
  }

  /**
   * Returns the exact UTC start and exclusive end instants for a given calendar month
   * in the application's timezone (envs.appTimezone).
   *
   * @param year - The calendar year (e.g. 2026)
   * @param month - The calendar month (1-12, e.g. 10 for October)
   */
  static getMonthBoundariesInUTC(year: number, month: number): { startDate: Date; endDate: Date } {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthIndex = month === 12 ? 0 : month; // 0-indexed for getStartOfLocalDayFromParts

    const startDate = this.getStartOfLocalDayFromParts(year, month - 1, 1);
    const endDate = this.getStartOfLocalDayFromParts(nextYear, nextMonthIndex, 1);

    return { startDate, endDate };
  }

  /**
   * Formats a date or timestamp into a local civil datetime string (DD/MM/YYYY HH:mm)
   * using the application's timezone (envs.appTimezone).
   */
  static formatLocalDateTime(date: Date | string | null, locale = 'es-BO'): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat(locale, {
      timeZone: envs.appTimezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  }

  /**
   * Formats a date or timestamp into a local civil date string (DD/MM/YYYY)
   * using the application's timezone (envs.appTimezone).
   */
  static formatLocalDate(date: Date | string | null, locale = 'es-BO'): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat(locale, {
      timeZone: envs.appTimezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  }

  /**
   * Extracts the calendar date/time parts in the application's timezone (envs.appTimezone).
   */
  static getLocalDateParts(date: Date | string | null) {
    if (!date) {
      return { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: envs.appTimezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value); // 1-12
    const day = parseInt(parts.find((p) => p.type === 'day')!.value);
    let hour = parseInt(parts.find((p) => p.type === 'hour')!.value);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find((p) => p.type === 'minute')!.value);
    const second = parseInt(parts.find((p) => p.type === 'second')!.value);
    return { year, month, day, hour, minute, second };
  }
}
