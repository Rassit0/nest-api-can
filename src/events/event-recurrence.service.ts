import { Injectable, BadRequestException } from '@nestjs/common';
import { RRule } from 'rrule';

export interface OccurrenceDateRange {
  startDate: Date;
  endDate: Date;
}

export interface ExpandRRuleWindowOptions {
  rruleStr: string;
  referenceStartDate: Date;
  durationMs: number;
  windowStartDate?: Date;
  windowEndDate?: Date;
}

@Injectable()
export class EventRecurrenceService {
  /**
   * Expande una regla RRULE dentro de una ventana de tiempo específica [windowStartDate, windowEndDate].
   * Separa conceptualmente:
   * - referenceStartDate: la fecha/hora de referencia de la recurrencia (dtstart).
   * - durationMs: la duración real de cada sesión/evento en milisegundos.
   * - windowStartDate / windowEndDate: la ventana en la que se deben generar las ocurrencias.
   */
  expandRRuleWindow(options: ExpandRRuleWindowOptions): OccurrenceDateRange[] {
    const { rruleStr, referenceStartDate, durationMs, windowStartDate, windowEndDate } = options;

    if (durationMs < 0) {
      throw new BadRequestException('La duración debe ser un valor positivo en milisegundos');
    }

    try {
      const rruleOptions = RRule.parseString(rruleStr);
      rruleOptions.dtstart = referenceStartDate;

      const rule = new RRule(rruleOptions);

      let startDates: Date[];
      if (windowStartDate && windowEndDate) {
        startDates = rule.between(windowStartDate, windowEndDate, true);
      } else if (windowStartDate) {
        const horizonLimit = new Date(windowStartDate);
        horizonLimit.setMonth(horizonLimit.getMonth() + 6);
        startDates = rule.between(windowStartDate, horizonLimit, true);
      } else {
        startDates = rule.all();
      }

      return startDates.map((start) => ({
        startDate: start,
        endDate: new Date(start.getTime() + durationMs),
      }));
    } catch (error) {
      throw new BadRequestException(`Formato RRULE inválido: ${(error as Error).message}`);
    }
  }

  /**
   * Determina si una regla RRULE ha concluido verdaderamente todas sus ocurrencias
   * después de la fecha de corte especificada (afterDate).
   * Utiliza la semántica formal de RRULE (evaluando UNTIL, COUNT, etc.),
   * retornando true únicamente si no existen ocurrencias futuras.
   */
  isSeriesCompleted(
    rruleStr: string,
    referenceStartDate: Date,
    afterDate: Date,
  ): boolean {
    try {
      const rruleOptions = RRule.parseString(rruleStr);
      rruleOptions.dtstart = referenceStartDate;
      const rule = new RRule(rruleOptions);
      return rule.after(afterDate) === null;
    } catch {
      return false;
    }
  }

  /**
   * Expands an RRULE string into an array of start/end dates.
   *
   * @param rruleStr The RRULE string (e.g., 'FREQ=WEEKLY;BYDAY=MO,WE')
   * @param originalStart The start date of the first occurrence
   * @param originalEnd The end date of the first occurrence
   * @param materializationMonths How many months ahead to materialize (default: 6)
   */
  expandRRule(
    rruleStr: string,
    originalStart: Date,
    originalEnd: Date,
    materializationMonths: number = 6,
  ): OccurrenceDateRange[] {
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    if (durationMs < 0) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    try {
      const rruleOptions = RRule.parseString(rruleStr);
      // Ensure the rule starts on or after the original start date
      rruleOptions.dtstart = originalStart;

      // Determine limit
      const limitDate = new Date();
      limitDate.setMonth(limitDate.getMonth() + materializationMonths);

      // If the rule already has a strict UNTIL, respect it if it's sooner than our limit
      if (rruleOptions.until && rruleOptions.until < limitDate) {
        // use their limit
      } else {
        rruleOptions.until = limitDate;
      }

      const rule = new RRule(rruleOptions);
      const startDates = rule.all();

      return startDates.map((start) => ({
        startDate: start,
        endDate: new Date(start.getTime() + durationMs),
      }));
    } catch (error) {
      throw new BadRequestException(`Formato RRULE inválido: ${(error as Error).message}`);
    }
  }
}
