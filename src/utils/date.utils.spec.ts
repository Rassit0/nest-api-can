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
});
