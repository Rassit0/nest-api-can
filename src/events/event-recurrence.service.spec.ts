import { BadRequestException } from '@nestjs/common';
import { EventRecurrenceService } from './event-recurrence.service';

describe('EventRecurrenceService', () => {
  let service: EventRecurrenceService;

  beforeEach(() => {
    service = new EventRecurrenceService();
  });

  describe('expandRRuleWindow', () => {
    it('debe conservar la duración exacta de 90 minutos en todas las ocurrencias', () => {
      const referenceStart = new Date('2026-06-01T14:00:00.000Z');
      const durationMs = 90 * 60 * 1000; // 90 minutos
      const windowStart = new Date('2026-06-01T00:00:00.000Z');
      const windowEnd = new Date('2026-06-30T23:59:59.000Z');

      const occurrences = service.expandRRuleWindow({
        rruleStr: 'FREQ=WEEKLY;BYDAY=MO,WE',
        referenceStartDate: referenceStart,
        durationMs,
        windowStartDate: windowStart,
        windowEndDate: windowEnd,
      });

      expect(occurrences.length).toBeGreaterThan(0);
      for (const occ of occurrences) {
        const diffMs = occ.endDate.getTime() - occ.startDate.getTime();
        expect(diffMs).toBe(durationMs);
        expect(occ.startDate.getUTCHours()).toBe(14);
        expect(occ.startDate.getUTCMinutes()).toBe(0);
        expect(occ.endDate.getUTCHours()).toBe(15);
        expect(occ.endDate.getUTCMinutes()).toBe(30);
      }
    });

    it('debe calcular correctamente la duración de una sesión que cruza la medianoche', () => {
      const referenceStart = new Date('2026-06-01T23:30:00.000Z');
      const durationMs = 90 * 60 * 1000; // 90 min -> termina a la 01:00 del día siguiente
      const windowStart = new Date('2026-06-01T00:00:00.000Z');
      const windowEnd = new Date('2026-06-15T23:59:59.000Z');

      const occurrences = service.expandRRuleWindow({
        rruleStr: 'FREQ=WEEKLY;BYDAY=MO',
        referenceStartDate: referenceStart,
        durationMs,
        windowStartDate: windowStart,
        windowEndDate: windowEnd,
      });

      expect(occurrences.length).toBe(3);
      for (const occ of occurrences) {
        expect(occ.endDate.getTime() - occ.startDate.getTime()).toBe(durationMs);
        expect(occ.startDate.getUTCHours()).toBe(23);
        expect(occ.startDate.getUTCMinutes()).toBe(30);
        expect(occ.endDate.getUTCHours()).toBe(1);
        expect(occ.endDate.getUTCMinutes()).toBe(0);
        expect(occ.endDate.getUTCDate()).toBe(occ.startDate.getUTCDate() + 1);
      }
    });

    it('debe retornar un arreglo vacío si la ventana no contiene días de la recurrencia', () => {
      // Serie únicamente de sábados
      const referenceStart = new Date('2026-01-03T14:00:00.000Z'); // Sábado
      const durationMs = 90 * 60 * 1000;
      // Ventana de lunes a martes
      const windowStart = new Date('2026-01-05T00:00:00.000Z'); // Lunes
      const windowEnd = new Date('2026-01-06T23:59:59.000Z'); // Martes

      const occurrences = service.expandRRuleWindow({
        rruleStr: 'FREQ=WEEKLY;BYDAY=SA',
        referenceStartDate: referenceStart,
        durationMs,
        windowStartDate: windowStart,
        windowEndDate: windowEnd,
      });

      expect(occurrences).toEqual([]);
    });

    it('debe rechazar duraciones negativas con BadRequestException', () => {
      expect(() =>
        service.expandRRuleWindow({
          rruleStr: 'FREQ=WEEKLY;BYDAY=MO',
          referenceStartDate: new Date('2026-06-01T14:00:00Z'),
          durationMs: -5000,
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('isSeriesCompleted', () => {
    it('debe retornar false si una serie de sábados se evalúa un lunes pero aún tiene sábados futuros', () => {
      const referenceStart = new Date('2026-01-03T14:00:00.000Z'); // Sábado
      // La regla tiene UNTIL en octubre de 2026
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20261031T235959Z';
      const lastMaterializedDate = new Date('2026-01-03T15:30:00.000Z');

      const isCompleted = service.isSeriesCompleted(
        rruleStr,
        referenceStart,
        lastMaterializedDate,
      );

      expect(isCompleted).toBe(false);
    });

    it('debe retornar true cuando una serie con UNTIL ha alcanzado y materializado su última fecha', () => {
      const referenceStart = new Date('2026-01-03T14:00:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20260110T235959Z';
      // Las ocurrencias son Jan 3 y Jan 10
      const afterJan10 = new Date('2026-01-10T15:30:00.000Z');

      const isCompleted = service.isSeriesCompleted(
        rruleStr,
        referenceStart,
        afterJan10,
      );

      expect(isCompleted).toBe(true);
    });

    it('debe retornar true cuando una serie con COUNT ha alcanzado el total máximo de ocurrencias', () => {
      const referenceStart = new Date('2026-01-03T14:00:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA;COUNT=3';
      // Ocurrencias: Jan 3, Jan 10, Jan 17
      const afterJan10 = new Date('2026-01-10T15:30:00.000Z');
      expect(service.isSeriesCompleted(rruleStr, referenceStart, afterJan10)).toBe(false);

      const afterJan17 = new Date('2026-01-17T15:30:00.000Z');
      expect(service.isSeriesCompleted(rruleStr, referenceStart, afterJan17)).toBe(true);
    });

    it('debe retornar false para series infinitas sin UNTIL ni COUNT', () => {
      const referenceStart = new Date('2026-01-03T14:00:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA';
      const farFutureDate = new Date('2030-12-31T23:59:59.000Z');

      expect(service.isSeriesCompleted(rruleStr, referenceStart, farFutureDate)).toBe(false);
    });
  });

  describe('expandRRule (backward compatibility)', () => {
    it('debe funcionar con la firma tradicional para previews y materialización inicial', () => {
      const start = new Date('2026-06-01T14:00:00.000Z');
      const end = new Date('2026-06-01T15:30:00.000Z');

      const occurrences = service.expandRRule(
        'FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        start,
        end,
        6,
      );

      expect(occurrences.length).toBe(4);
      expect(occurrences[0].endDate.getTime() - occurrences[0].startDate.getTime()).toBe(90 * 60 * 1000);
    });
  });
});
