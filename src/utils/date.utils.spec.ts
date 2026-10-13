import { DateUtils } from './date.utils';
import { envs } from '../config/envs';

describe('DateUtils', () => {
  describe('getEndOfLocalDayFromParts', () => {
    it('should generate exact UTC instant for 01/08/2026 23:59:59.999 in America/La_Paz', () => {
      // 0 = Jan, 7 = Aug
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 7, 1);
      expect(result.toISOString()).toBe('2026-08-02T03:59:59.999Z');
    });

    it('should handle start of year (01/01/2026)', () => {
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 0, 1);
      expect(result.toISOString()).toBe('2026-01-02T03:59:59.999Z');
    });

    it('should handle end of year (31/12/2026)', () => {
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 11, 31);
      expect(result.toISOString()).toBe('2027-01-01T03:59:59.999Z');
    });

    it('should handle February bounds (28/02/2026)', () => {
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 1, 28);
      expect(result.toISOString()).toBe('2026-03-01T03:59:59.999Z');
    });

    it('should handle February leap year bounds (29/02/2024)', () => {
      const result = DateUtils.getEndOfLocalDayFromParts(2024, 1, 29);
      expect(result.toISOString()).toBe('2024-03-01T03:59:59.999Z');
    });
  });

  describe('getEndOfLocalDayFromParts with mock envs for DST', () => {
    let originalTimezone: string;

    beforeAll(() => {
      originalTimezone = envs.appTimezone;
    });

    afterAll(() => {
      envs.appTimezone = originalTimezone;
    });

    it('should handle DST transition in America/New_York (Spring Forward)', () => {
      envs.appTimezone = 'America/New_York';
      // March 8, 2026 - transition from EST (UTC-5) to EDT (UTC-4) at 2:00 AM
      // Target end of day local is 23:59:59 EDT (UTC-4) -> should be 03:59:59 next day UTC
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 2, 8);
      expect(result.toISOString()).toBe('2026-03-09T03:59:59.999Z');
    });

    it('should handle standard time in America/New_York (Winter)', () => {
      envs.appTimezone = 'America/New_York';
      // Jan 15, 2026 - EST (UTC-5)
      // Target end of day local is 23:59:59 EST (UTC-5) -> should be 04:59:59 next day UTC
      const result = DateUtils.getEndOfLocalDayFromParts(2026, 0, 15);
      expect(result.toISOString()).toBe('2026-01-16T04:59:59.999Z');
    });
  });

  describe('getMonthBoundariesInUTC & Timezone Independence', () => {
    let originalTimezone: string;

    beforeAll(() => {
      originalTimezone = envs.appTimezone;
    });

    afterAll(() => {
      envs.appTimezone = originalTimezone;
    });

    it('13. Con envs.appTimezone=America/La_Paz, octubre 2026 produce exactamente 04:00Z para start y end', () => {
      envs.appTimezone = 'America/La_Paz';
      const { startDate, endDate } = DateUtils.getMonthBoundariesInUTC(2026, 10);

      expect(startDate.toISOString()).toBe('2026-10-01T04:00:00.000Z');
      expect(endDate.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    });

    it('14. Test de borde inicial: 03:59:59.999Z está fuera de octubre; 04:00:00.000Z está dentro', () => {
      envs.appTimezone = 'America/La_Paz';
      const { startDate, endDate } = DateUtils.getMonthBoundariesInUTC(2026, 10);

      const beforeStart = new Date('2026-10-01T03:59:59.999Z'); // 30/09/2026 23:59:59.999 en La Paz
      const atStart = new Date('2026-10-01T04:00:00.000Z'); // 01/10/2026 00:00:00.000 en La Paz

      expect(beforeStart.getTime() >= startDate.getTime() && beforeStart.getTime() < endDate.getTime()).toBe(false);
      expect(atStart.getTime() >= startDate.getTime() && atStart.getTime() < endDate.getTime()).toBe(true);
    });

    it('15. Test de borde final: 31 oct 23:59:59.999 local (03:59:59.999Z) está dentro; 04:00:00.000Z está fuera', () => {
      envs.appTimezone = 'America/La_Paz';
      const { startDate, endDate } = DateUtils.getMonthBoundariesInUTC(2026, 10);

      const lastInstantOfOctober = new Date('2026-11-01T03:59:59.999Z'); // 31/10/2026 23:59:59.999 en La Paz
      const firstInstantOfNovember = new Date('2026-11-01T04:00:00.000Z'); // 01/11/2026 00:00:00.000 en La Paz

      expect(lastInstantOfOctober.getTime() >= startDate.getTime() && lastInstantOfOctober.getTime() < endDate.getTime()).toBe(true);
      expect(firstInstantOfNovember.getTime() >= startDate.getTime() && firstInstantOfNovember.getTime() < endDate.getTime()).toBe(false);
    });

    it('16. Test de presentación: transacción nocturna 2026-10-04T02:00:00.000Z muestra 03/10/2026 en America/La_Paz', () => {
      envs.appTimezone = 'America/La_Paz';
      const nightTxDate = new Date('2026-10-04T02:00:00.000Z');

      const dateStr = DateUtils.formatLocalDate(nightTxDate);
      expect(dateStr).toBe('03/10/2026');

      const dateTimeStr = DateUtils.formatLocalDateTime(nightTxDate);
      expect(dateTimeStr).toContain('03/10/2026');
      expect(dateTimeStr).toContain('22:00');

      const parts = DateUtils.getLocalDateParts(nightTxDate);
      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(10);
      expect(parts.day).toBe(3);
      expect(parts.hour).toBe(22);
      expect(parts.minute).toBe(0);
    });
  });
});
