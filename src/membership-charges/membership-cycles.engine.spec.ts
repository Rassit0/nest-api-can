import { simulateAllCycles, SimulatedCycle } from './membership-cycles.engine';
import { PlayerMembershipWithRelations } from './membership-financial.calculator';
import { DateUtils } from 'src/utils/date.utils';

describe('MembershipCyclesEngine', () => {
  const getMockMembership = (): PlayerMembershipWithRelations => {
    return {
      id: 'test-membership',
      playerId: 'player-1',
      teamSeasonId: 'team-season-1',
      paymentPlanId: 'payment-plan-1',
      status: 'ACTIVE',
      startedAt: new Date(Date.UTC(2024, 0, 15)), // Jan 15, 2024
      isMigrated: false,
      nextRecurringChargeGenerationDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      membershipDiscounts: [],
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
      teamSeason: {
        id: 'team-season-1',
        teamId: 'team-1',
        seasonId: 'season-1',
        billingConfig: {
          id: 'config-1',
          teamSeasonId: 'team-season-1',
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
    } as unknown as PlayerMembershipWithRelations;
  };

  it('should generate all valid cycles for a standard season', () => {
    const membership = getMockMembership();
    const cycles = simulateAllCycles(membership);

    expect(cycles.length).toBeGreaterThan(0);

    // First cycle
    expect(cycles[0].cycleCounter).toBe(1);
    expect(cycles[0].isFirstCycle).toBe(true);
    expect(cycles[0].dueDate.toISOString()).toEqual(DateUtils.getEndOfLocalDayFromParts(2024, 0, 1).toISOString()); // Jan 1st end of civil day
    expect(cycles[0].nextDueDate.toISOString()).toEqual(DateUtils.getEndOfLocalDayFromParts(2024, 1, 1).toISOString()); // Feb 1st end of civil day

    // Check if descriptions mark prorating
    expect(cycles[0].description).toContain('Prorrateado');

    // Last cycle
    const lastCycle = cycles[cycles.length - 1];
    expect(lastCycle.nextDueDate.getTime()).toBeGreaterThan(
      membership.teamSeason.season.endDate.getTime(),
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
    membership.teamSeason.billingConfig.billingFrequency = 'WEEKLY';

    const cycles = simulateAllCycles(membership);

    expect(cycles.length).toBeGreaterThan(12); // Should be roughly 50 weeks
    expect(cycles[0].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 15))));
    expect(cycles[0].nextDueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 22))));
    expect(cycles[1].dueDate).toEqual(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2024, 0, 22))));
  });

  it('should cap out at MAX_BILLING_CYCLES', () => {
    const membership = getMockMembership();
    membership.teamSeason.billingConfig.billingFrequency = 'WEEKLY';
    // Very long season to hit max cycles
    membership.teamSeason.season.endDate = new Date(
      Date.UTC(2030, 11, 31, 23, 59, 59, 999),
    );

    const cycles = simulateAllCycles(membership);
    expect(cycles.length).toBeLessThanOrEqual(60); // MAX_BILLING_CYCLES
  });

  it('should appropriately end generation after season end date', () => {
    const membership = getMockMembership();
    // Short season (3 months)
    membership.teamSeason.season.endDate = new Date(
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
      membership.endedAt = new Date(Date.UTC(2024, 1, 3)); // Feb 3

      const cycles = simulateAllCycles(membership);

      // Should generate Jan 1 and Feb 1 (civil days).
      expect(cycles.length).toBe(2);
      expect(cycles[1].dueDate.toISOString()).toBe(DateUtils.getEndOfLocalDayFromParts(2024, 1, 1).toISOString()); // Feb 1
      expect(cycles[1].nextDueDate.toISOString()).toBe(
        DateUtils.getEndOfLocalDayFromParts(2024, 2, 1).toISOString(),
      ); // Mar 1
    });

    it('should generate up to cancellation date if Season is CANCELLED', () => {
      const membership = getMockMembership();
      // Suppose the season is cancelled on Feb 10
      membership.teamSeason.season.status = 'CANCELLED';
      membership.teamSeason.season.endDate = new Date(Date.UTC(2024, 1, 10)); // Feb 10

      const cycles = simulateAllCycles(membership);

      // Cycles: Jan 1, Feb 1 (civil days). Next is Mar 1 which is after Feb 10.
      expect(cycles.length).toBe(2);
      expect(cycles[1].nextDueDate.toISOString()).toBe(
        DateUtils.getEndOfLocalDayFromParts(2024, 2, 1).toISOString(),
      ); // Mar 1
    });
  });

  describe('Timezone Late Fee Regression Test (+1 day bug)', () => {
    it('should correctly construct dueDate matching exactly the end of target civil day', () => {
      const membership = getMockMembership();
      
      // We simulate the August 2026 cycle generation
      // targetYear = 2026, targetMonth = agosto (7), billingDay = 1
      membership.startedAt = new Date(Date.UTC(2026, 6, 1)); // Jul 1, 2026
      membership.teamSeason.season.startDate = new Date(Date.UTC(2026, 0, 1));
      membership.teamSeason.season.endDate = new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999));
      
      const cycles = simulateAllCycles(membership);
      
      // Cycle 0: July 1
      // Cycle 1: August 1
      const augustCycle = cycles[1];
      
      expect(augustCycle.billingYear).toBe(2026);
      expect(augustCycle.billingMonth).toBe(8);
      
      // BEFORE FIX: The cycle engine returned 2026-08-01T03:59:59.999Z (which is July 31st 23:59:59 in La Paz)
      // AFTER FIX: It should return exactly 2026-08-02T03:59:59.999Z (which is Aug 1st 23:59:59 in La Paz)
      expect(augustCycle.dueDate.toISOString()).toBe('2026-08-02T03:59:59.999Z');
    });
  });
});
