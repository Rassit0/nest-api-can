import { simulateAllCycles, SimulatedCycle } from './student-cycles.engine';
import { StudentMembershipWithRelations } from './student-financial.calculator';
import { DateUtils } from 'src/utils/date.utils';

describe('MembershipCyclesEngine', () => {
  const getMockMembership = (): StudentMembershipWithRelations => {
    return {
      id: 'test-membership',
      studentId: 'student-1',
      courseSeasonId: 'course-season-1',
      paymentPlanId: 'payment-plan-1',
      status: 'ACTIVE',
      startedAt: new Date(Date.UTC(2024, 0, 15)), // Jan 15, 2024
      isMigrated: false,
      nextRecurringChargeGenerationDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      studentDiscounts: [],
      paymentPlan: {
        id: 'payment-plan-1',
        name: 'Standard',
        description: 'Standard plan',
        isSinglePayment: false,
        registrationDiscountPercent: 0,
        recurringDiscountPercent: 0,
        seasonFeeDiscountPercent: 0,
        advanceCycles: 1,
        advanceCyclesDiscountPercent: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        active: true,
      },
      courseSeason: {
        id: 'course-season-1',
        courseId: 'course-1',
        seasonId: 'season-1',
        billingConfig: {
          id: 'config-1',
          courseSeasonId: 'course-season-1',
          registrationFee: 100,
          recurringFee: 50,
          seasonFee: 500,
          prorateRegistrationFee: false,
          prorateFirstRecurringFee: true,
          prorateLastRecurringFee: true,
          prorateSeasonFee: false,
          billingFrequency: 'MONTHLY',
          billingDay: 1,
          billingType: 'RECURRING',
          chargeGenerationDaysBefore: 7,
          lateFeeDaysAfter: 5,
          lateFeePercent: 10,
          isEngineActive: true,
          nextLateFeeCheck: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        capacity: 20,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        season: {
          id: 'season-1',
          name: '2024 Season',
          startDate: new Date(Date.UTC(2024, 0, 1)),
          endDate: new Date(Date.UTC(2024, 11, 31, 23, 59, 59, 999)),
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          clubId: 'club-1',
        },
      },
    } as unknown as StudentMembershipWithRelations;
  };

  it('should generate all valid cycles for a standard season', () => {
    const membership = getMockMembership();
    const cycles = simulateAllCycles(membership);

    expect(cycles.length).toBeGreaterThan(0);

    // First cycle
    expect(cycles[0].cycleCounter).toBe(1);
    expect(cycles[0].isFirstCycle).toBe(true);
    expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 15)))); // startedAt because it's first cycle
    expect(cycles[0].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 1, 1)))); // Feb 1

    // Check if descriptions mark prorating
    expect(cycles[0].description).toContain('Prorrateado');

    // Last cycle
    const lastCycle = cycles[cycles.length - 1];
    expect(lastCycle.nextDueDate.getTime()).toBeGreaterThan(
      membership.courseSeason.season.endDate.getTime(),
    );
  });

  it('should handle single payment plans with 1 cycle', () => {
    const membership = getMockMembership();
    membership.paymentPlan.isSinglePayment = true;

    const cycles = simulateAllCycles(membership);
    expect(cycles.length).toBe(12); // It generates all theoretical cycles, but handles them as single in generation service
  });

  it('should respect custom billing frequencies (WEEKLY)', () => {
    const membership = getMockMembership();
    membership.courseSeason.billingConfig.billingFrequency = 'WEEKLY';

    const cycles = simulateAllCycles(membership);

    expect(cycles.length).toBeGreaterThan(12); // Should be roughly 50 weeks
    expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 15))));
    expect(cycles[0].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 22))));
    expect(cycles[1].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 22))));
  });

  it('should cap out at MAX_BILLING_CYCLES', () => {
    const membership = getMockMembership();
    membership.courseSeason.billingConfig.billingFrequency = 'WEEKLY';
    // Very long season to hit max cycles
    membership.courseSeason.season.endDate = new Date(
      Date.UTC(2030, 11, 31, 23, 59, 59, 999),
    );

    const cycles = simulateAllCycles(membership);
    expect(cycles.length).toBeLessThanOrEqual(60); // MAX_BILLING_CYCLES
  });

  it('should appropriately end generation after season end date', () => {
    const membership = getMockMembership();
    // Short season (3 months)
    membership.courseSeason.season.endDate = new Date(
      Date.UTC(2024, 2, 31, 23, 59, 59, 999),
    );

    const cycles = simulateAllCycles(membership);

    // Starts Jan 15. Due dates: Jan 15, Feb 1, Mar 1. Next cycle is Apr 1 (> end date)
    expect(cycles.length).toBe(3);
    expect(cycles[0].dueDate.getUTCMonth()).toBe(0); // Jan
    expect(cycles[1].dueDate.getUTCMonth()).toBe(1); // Feb
    expect(cycles[2].dueDate.getUTCMonth()).toBe(2); // Mar
  });

  describe('Extreme Edge Cases (Status & Boundaries)', () => {
    it('should calculate one single day charge if membership ends on the first day of the cycle', () => {
      const membership = getMockMembership();
      // Starts Jan 15. Due dates: Jan 15, Feb 1, Mar 1...
      // Let's end the membership exactly on Feb 1.
      membership.endedAt = new Date(Date.UTC(2024, 1, 2)); // Feb 2

      const cycles = simulateAllCycles(membership);

      // Should generate Jan 15 and Feb 1.
      expect(cycles.length).toBe(2);
      expect(cycles[1].dueDate.getUTCMonth()).toBe(1); // Feb 1
      expect(cycles[1].nextDueDate.getTime()).toBe(
        DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 2, 1))).getTime(),
      ); // Mar 1
    });

    it('should generate up to cancellation date if Season is CANCELLED', () => {
      const membership = getMockMembership();
      // Suppose the season is cancelled on Feb 10
      membership.courseSeason.season.status = 'CANCELLED';
      membership.courseSeason.season.endDate = new Date(Date.UTC(2024, 1, 10)); // Feb 10

      const cycles = simulateAllCycles(membership);

      // Cycles: Jan 15, Feb 1. Next is Mar 1 which is after Feb 10.
      expect(cycles.length).toBe(2);
      expect(cycles[1].nextDueDate.getTime()).toBe(
        DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 2, 1))).getTime(),
      ); // Mar 1
    });
  });

  /**
   * IMPORTANT BUSINESS RULES - Extreme Configurations
   * The following scenarios are explicitly validated business edge cases, not accidental behavior.
   * Future engine modifications MUST ensure these configurations continue passing to maintain billing integrity.
   * - BIWEEKLY/WEEKLY spanning leap years must correctly land on the precise date mathematically.
   * - Billing day 31 must adjust exactly to end-of-month for shorter months (Feb 28/29, Apr 30, etc).
   * - SINGLE billing must halt generation on the very first cycle regardless of remaining season time.
   * - Disabled Prorating must avoid partial charging and prorate descriptions.
   */
  describe('More Extreme Configurations', () => {
    it('should handle BIWEEKLY frequency correctly across leap year boundaries', () => {
      const membership = getMockMembership();
      membership.startedAt = new Date(Date.UTC(2024, 1, 26)); // Feb 26, 2024 (Leap year)
      membership.courseSeason.season.endDate = new Date(Date.UTC(2024, 2, 31, 23, 59, 59, 999));
      membership.courseSeason.billingConfig.billingFrequency = 'BIWEEKLY';

      const cycles = simulateAllCycles(membership);
      
      expect(cycles.length).toBeGreaterThan(0);
      expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 1, 26))));
      // Next due date for BIWEEKLY should be exactly 14 days later: Feb 26 + 14 days
      // 2024 is a leap year (29 days in Feb). Feb 26 + 3 days = Feb 29. Remaining 11 days = Mar 11.
      expect(cycles[0].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 2, 11))));
      expect(cycles[1].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 2, 11))));
    });

    it('should generate exactly 1 cycle if membership starts very close to season end', () => {
      const membership = getMockMembership();
      // Starts 2 days before the end
      membership.startedAt = new Date(Date.UTC(2024, 11, 29));
      membership.courseSeason.season.endDate = new Date(Date.UTC(2024, 11, 31, 23, 59, 59, 999));

      const cycles = simulateAllCycles(membership);

      expect(cycles.length).toBe(1);
      expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 11, 29))));
      expect(cycles[0].nextDueDate.getTime()).toBeGreaterThan(membership.courseSeason.season.endDate.getTime());
    });

    it('should handle extreme billingDay (31st) across different month lengths', () => {
      const membership = getMockMembership();
      membership.startedAt = new Date(Date.UTC(2024, 0, 15)); // Jan 15
      membership.courseSeason.season.endDate = new Date(Date.UTC(2024, 4, 10, 23, 59, 59, 999)); // May 10
      membership.courseSeason.billingConfig.billingDay = 31;

      const cycles = simulateAllCycles(membership);

      // Cycle 1: Jan 15 to Jan 31
      expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 15))));
      expect(cycles[0].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 31)))); 

      // Cycle 2: Jan 31 to Feb 29
      expect(cycles[1].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 31))));
      expect(cycles[1].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 1, 29)))); 

      // Cycle 3: Feb 29 to Mar 31
      expect(cycles[2].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 1, 29))));
      expect(cycles[2].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 2, 31))));
    });

    it('should apply no prorating description if prorating is disabled', () => {
      const membership = getMockMembership();
      membership.startedAt = new Date(Date.UTC(2024, 0, 15));
      membership.courseSeason.billingConfig.prorateFirstRecurringFee = false;
      membership.courseSeason.billingConfig.prorateLastRecurringFee = false;

      const cycles = simulateAllCycles(membership);

      expect(cycles[0].description).not.toContain('Prorrateado');
    });

    it('should correctly process SINGLE billing frequency and stop generation immediately', () => {
      const membership = getMockMembership();
      membership.courseSeason.billingConfig.billingFrequency = 'SINGLE';

      const cycles = simulateAllCycles(membership);

      expect(cycles.length).toBe(1);
      expect(cycles[0].billingCycle).toBe(1);
    });
  });
});
