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
    
    // Calculamos el offset dinámicamente usando la zona horaria configurada
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: envs.appTimezone }));
    const finalOffset = Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60));

    const d = new Date(date);
    
    // Primero, lo posicionamos al final del día UTC (23:59:59.999)
    d.setUTCHours(23, 59, 59, 999);
    
    // Luego, le restamos el offset (ej: --4 = +4 horas).
    d.setUTCHours(d.getUTCHours() - finalOffset);
    
    return d;
  }

  static getStartOfUTCDay(date: Date | string | null = new Date()): Date {
    if (!date) return new Date();
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
}
