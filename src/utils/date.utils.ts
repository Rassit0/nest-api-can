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
}
