import { Injectable, BadRequestException } from '@nestjs/common';
import { RRule } from 'rrule';

export interface OccurrenceDateRange {
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class EventRecurrenceService {
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
