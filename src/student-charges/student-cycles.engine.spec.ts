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
        active: true
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
          clubId: 'club-1'
        }
      }
    } as unknown as StudentMembershipWithRelations;
  };

  it('should generate all valid cycles for a standard season', () => {
    const membership = getMockMembership();
    const cycles = simulateAllCycles(membership);
    
    expect(cycles.length).toBeGreaterThan(0);
    
    // First cycle
    expect(cycles[0].cycleCounter).toBe(1);
    expect(cycles[0].isFirstCycle).toBe(true);
    expect(cycles[0].dueDate).toEqual(new Date(Date.UTC(2024, 0, 15))); // startedAt because it's first cycle
    expect(cycles[0].nextDueDate).toEqual(new Date(Date.UTC(2024, 1, 1))); // Feb 1
    
    // Check if descriptions mark prorating
    expect(cycles[0].description).toContain('Prorrateado');

    // Last cycle
    const lastCycle = cycles[cycles.length - 1];
    expect(lastCycle.nextDueDate.getTime()).toBeGreaterThan(membership.courseSeason.season.endDate.getTime());
  });

  it('should handle single payment plans with 1 cycle', () => {
    const membership = getMockMembership();
    membership.paymentPlan.isSinglePayment = true;
    
    const cycles = simulateAllCycles(membership);
    expect(cycles.length).toBe(12); // It generates all theoretical cycles, but handles them as single in generation service
  });

  it('should respect custom billing frequencies (WEEKLY)', () => {
    const membership = getMockMembership();
    membership.courseSeason.billingConfig!.billingFrequency = 'WEEKLY';
    
    const cycles = simulateAllCycles(membership);
    
    expect(cycles.length).toBeGreaterThan(12); // Should be roughly 50 weeks
    expect(cycles[0].dueDate).toEqual(new Date(Date.UTC(2024, 0, 15)));
    expect(cycles[0].nextDueDate).toEqual(new Date(Date.UTC(2024, 0, 22)));
    expect(cycles[1].dueDate).toEqual(new Date(Date.UTC(2024, 0, 22)));
  });

  it('should cap out at MAX_BILLING_CYCLES', () => {
    const membership = getMockMembership();
    membership.courseSeason.billingConfig!.billingFrequency = 'WEEKLY';
    // Very long season to hit max cycles
    membership.courseSeason.season.endDate = new Date(Date.UTC(2030, 11, 31, 23, 59, 59, 999));
    
    const cycles = simulateAllCycles(membership);
    expect(cycles.length).toBeLessThanOrEqual(60); // MAX_BILLING_CYCLES
  });

  it('should appropriately end generation after season end date', () => {
    const membership = getMockMembership();
    // Short season (3 months)
    membership.courseSeason.season.endDate = new Date(Date.UTC(2024, 2, 31, 23, 59, 59, 999));
    
    const cycles = simulateAllCycles(membership);
    
    // Starts Jan 15. Due dates: Jan 15, Feb 1, Mar 1. Next cycle is Apr 1 (> end date)
    expect(cycles.length).toBe(3);
    expect(cycles[0].dueDate.getUTCMonth()).toBe(0); // Jan
    expect(cycles[1].dueDate.getUTCMonth()).toBe(1); // Feb
    expect(cycles[2].dueDate.getUTCMonth()).toBe(2); // Mar
  });
});

