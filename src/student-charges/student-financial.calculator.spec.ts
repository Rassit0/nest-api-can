import {
  calculateRegistrationFee,
  calculateRecurringFeeForDate,
  calculateSinglePaymentFee,
  StudentMembershipWithRelations,
  FinancialCalculationResult,
} from './student-financial.calculator';
import { Prisma, StatusCourseSeason } from 'src/generated/prisma/client';
import { MILLISECONDS_IN_DAY } from './student-billing.utils';

describe('MembershipFinancialCalculator', () => {
  const getMockMembership = (): StudentMembershipWithRelations => {
    return {
      id: 'test-membership',
      studentId: 'student-1',
      courseSeasonId: 'course-season-1',
      paymentPlanId: 'payment-plan-1',
      status: 'ACTIVE',
      startedAt: new Date('2024-01-01T00:00:00Z'),
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
          lateFeeDaysAfter: 5,
          lateFeePercent: 10,
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
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-12-31T23:59:59Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          clubId: 'club-1',
        },
      },
    } as unknown as StudentMembershipWithRelations;
  };

  describe('calculateRegistrationFee', () => {
    it('should calculate basic registration fee without discounts', () => {
      const membership = getMockMembership();
      const result = calculateRegistrationFee(membership);
      expect(result.baseAmount).toBe(100);
      expect(result.netAmount).toBe(100);
      expect(result.discountPercent).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.appliedDiscounts.length).toBe(0);
    });

    it('should apply payment plan discount to registration fee', () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(
        20,
      );

      const result = calculateRegistrationFee(membership);
      expect(result.baseAmount).toBe(100);
      expect(result.netAmount).toBe(80);
      expect(result.discountPercent).toBe(20);
      expect(result.discountAmount).toBe(20);
      expect(result.appliedDiscounts[0].reason).toBe('Plan de pago');
    });

    it('should cap discount at 100% and result in $0 netAmount', () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(
        100,
      );

      const result = calculateRegistrationFee(membership);
      expect(result.baseAmount).toBe(100);
      expect(result.netAmount).toBe(0);
      expect(result.discountPercent).toBe(100);
      expect(result.discountAmount).toBe(100);
    });

    it('should calculate prorated registration fee correctly', () => {
      const membership = getMockMembership();
      membership.courseSeason.billingConfig.prorateRegistrationFee = true;
      membership.startedAt = new Date('2024-07-01T00:00:00Z'); // Halfway through the year

      const result = calculateRegistrationFee(membership);
      // Roughly half of the year passed, so baseAmount should be ~50
      expect(result.baseAmount).toBeLessThan(100);
      expect(result.baseAmount).toBeGreaterThan(45);
    });

    it('should accumulate custom membership discounts with payment plan discounts', () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(
        10,
      );
      membership.studentDiscounts = [
        {
          id: 'discount-1',
          studentMembershipId: membership.id,
          type: 'BECADO',
          reason: 'Beca deportiva',
          registrationDiscountPercent: 20,
          recurringDiscountPercent: 0,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as any,
      ];

      const result = calculateRegistrationFee(membership);
      expect(result.discountPercent).toBe(30);
      expect(result.netAmount).toBe(70);
    });
  });

  describe('calculateRecurringFeeForDate', () => {
    it('should calculate basic recurring fee without prorating', () => {
      const membership = getMockMembership();
      const dueDate = new Date('2024-02-01T00:00:00Z');
      const result = calculateRecurringFeeForDate(membership, dueDate);
      expect(result.baseAmount).toBe(50);
      expect(result.netAmount).toBe(50);
    });

    it('should prorate the first cycle fee if joining late in the month', () => {
      const membership = getMockMembership();
      membership.startedAt = new Date('2024-01-16T00:00:00Z'); // Joined mid-month
      const dueDate = new Date('2024-01-16T00:00:00Z');
      const nextDueDate = new Date('2024-02-01T00:00:00Z');
      const theoreticalDueDate = new Date('2024-01-01T00:00:00Z');

      const result = calculateRecurringFeeForDate(
        membership,
        dueDate,
        true,
        nextDueDate,
        undefined,
        theoreticalDueDate,
      );

      // Full month is ~31 days, active days ~16.
      // Base should be approx 50 * (16/31) ~ 25.8
      expect(result.baseAmount).toBeLessThan(50);
      expect(result.baseAmount).toBeGreaterThan(20);
      expect(result.netAmount).toBe(result.baseAmount);
    });

    it('should prorate the last cycle fee if season ends before next due date', () => {
      const membership = getMockMembership();
      const dueDate = new Date('2024-12-01T00:00:00Z');
      const nextDueDate = new Date('2025-01-01T00:00:00Z');
      const seasonEnd = new Date('2024-12-15T23:59:59Z');

      const result = calculateRecurringFeeForDate(
        membership,
        dueDate,
        false,
        nextDueDate,
        seasonEnd,
      );

      // Should charge for approx 15 days out of 31 days
      expect(result.baseAmount).toBeLessThan(50);
      expect(result.baseAmount).toBeGreaterThan(20);
    });

    it('should apply advance payment discounts', () => {
      const membership = getMockMembership();
      membership.paymentPlan.advanceCycles = 3;
      membership.paymentPlan.advanceCyclesDiscountPercent = new Prisma.Decimal(
        15,
      );

      // Current cycle = 1 (within advance cycles)
      const resultCycle1 = calculateRecurringFeeForDate(
        membership,
        new Date(),
        false,
        undefined,
        undefined,
        undefined,
        1,
      );
      expect(resultCycle1.discountPercent).toBe(15);

      // Current cycle = 4 (outside advance cycles)
      const resultCycle4 = calculateRecurringFeeForDate(
        membership,
        new Date(),
        false,
        undefined,
        undefined,
        undefined,
        4,
      );
      expect(resultCycle4.discountPercent).toBe(0);
    });
  });

  describe('calculateSinglePaymentFee', () => {
    it('should calculate single payment using seasonFee when provided', () => {
      const membership = getMockMembership();
      const result = calculateSinglePaymentFee(membership, 0, 0);

      expect(result.baseAmount).toBe(500); // from seasonFee
      expect(result.hasSinglePaymentAmount).toBe(true);
    });

    it('should prorate seasonFee when joining late in the season', () => {
      const membership = getMockMembership();
      membership.courseSeason.billingConfig.prorateSeasonFee = true;
      membership.startedAt = new Date('2024-07-01T00:00:00Z'); // Half season

      const result = calculateSinglePaymentFee(membership, 0, 0);

      expect(result.baseAmount).toBeLessThan(500);
      expect(result.baseAmount).toBeGreaterThan(240);
    });

    it('should use accumulated values if no seasonFee is configured', () => {
      const membership = getMockMembership();
      membership.courseSeason.billingConfig.seasonFee = null;

      const result = calculateSinglePaymentFee(membership, 600, 10);

      expect(result.baseAmount).toBe(600);
      expect(result.discountPercent).toBe(10);
      expect(result.netAmount).toBe(540); // 600 - 10%
    });
  });

  describe('Extreme Edge Cases (Prorate & Pauses)', () => {
    it('should result in $0 charge if a pause completely engulfs the billing cycle', () => {
      const membership = getMockMembership();
      // Cycle: Jan 1 to Jan 31
      const cycleStart = new Date('2024-01-01T00:00:00Z');
      const cycleEnd = new Date('2024-02-01T00:00:00Z');

      // Pause: Dec 15 to Feb 15 (completely covers cycle)
      membership.courseSeason.pauses = [
        {
          id: 'pause-1',
          startDate: new Date('2023-12-15T00:00:00Z'),
          endDate: new Date('2024-02-15T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );
      expect(result.netAmount).toBe(0);
    });

    it('should not double-subtract days for overlapping CourseSeasonPause and MembershipPause', () => {
      const membership = getMockMembership();
      const cycleStart = new Date('2024-04-01T00:00:00Z');
      const cycleEnd = new Date('2024-05-01T00:00:00Z');

      // Global Pause: Apr 10 to Apr 20 (11 days)
      membership.courseSeason.pauses = [
        {
          id: 'global-pause',
          startDate: new Date('2024-04-10T00:00:00Z'),
          endDate: new Date('2024-04-20T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      // Membership Pause: Apr 15 to Apr 25 (11 days)
      membership.pauses = [
        {
          id: 'member-pause',
          startDate: new Date('2024-04-15T00:00:00Z'),
          endDate: new Date('2024-04-25T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      // Total pause span should be Apr 10 to Apr 25 = 15 days.
      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );
      // Active = 30 - 15 = 15 days. (50 * 15/30) = 25
      expect(result.netAmount).toBe(25);
    });

    it('should correctly handle multiple fragmented pauses in a single cycle', () => {
      const membership = getMockMembership();
      // 30 days cycle
      const cycleStart = new Date('2024-04-01T00:00:00Z');
      const cycleEnd = new Date('2024-05-01T00:00:00Z');

      membership.courseSeason.pauses = [
        {
          id: 'pause-1',
          startDate: new Date('2024-04-05T00:00:00Z'),
          endDate: new Date('2024-04-08T00:00:00Z'), // 3 days
          status: 'ACTIVE',
        } as any,
        {
          id: 'pause-2',
          startDate: new Date('2024-04-12T00:00:00Z'),
          endDate: new Date('2024-04-17T00:00:00Z'), // 5 days
          status: 'ACTIVE',
        } as any,
        {
          id: 'pause-3', // Out of order just to test sorting
          startDate: new Date('2024-04-25T00:00:00Z'),
          endDate: new Date('2024-04-27T00:00:00Z'), // 2 days
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );
      // Total pause = 10 days. Active = 20 days.
      // Net amount = 50 * (20/30) = 33.33
      expect(result.netAmount).toBe(33.33);
    });

    it('should correctly handle a massive pause that spans across multiple cycles', () => {
      const membership = getMockMembership();
      // Massive pause from March 15 to May 15
      membership.pauses = [
        {
          id: 'massive-pause',
          startDate: new Date('2024-03-15T00:00:00Z'),
          endDate: new Date('2024-05-15T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      // Test Cycle 1: March (March 1 to April 1) -> 31 days
      // Pause in March is March 15 to April 1 -> 17 days
      // Active = 31 - 17 = 14 days. Expected = 50 * (14/31) = 22.58
      const cycleMarchStart = new Date('2024-03-01T00:00:00Z');
      const cycleMarchEnd = new Date('2024-04-01T00:00:00Z');
      const resultMarch = calculateRecurringFeeForDate(
        membership,
        cycleMarchStart,
        false,
        cycleMarchEnd,
      );
      expect(resultMarch.netAmount).toBe(22.58);

      // Test Cycle 2: April (April 1 to May 1) -> 30 days
      // Pause completely engulfs April
      const cycleAprilStart = new Date('2024-04-01T00:00:00Z');
      const cycleAprilEnd = new Date('2024-05-01T00:00:00Z');
      const resultApril = calculateRecurringFeeForDate(
        membership,
        cycleAprilStart,
        false,
        cycleAprilEnd,
      );
      expect(resultApril.netAmount).toBe(0);

      // Test Cycle 3: May (May 1 to June 1) -> 31 days
      // Pause in May is May 1 to May 15 -> 14 days
      // Active = 31 - 14 = 17 days. Expected = 50 * (17/31) = 27.42
      const cycleMayStart = new Date('2024-05-01T00:00:00Z');
      const cycleMayEnd = new Date('2024-06-01T00:00:00Z');
      const resultMay = calculateRecurringFeeForDate(
        membership,
        cycleMayStart,
        false,
        cycleMayEnd,
      );
      expect(resultMay.netAmount).toBe(27.42);
    });

    it('should correctly combine early termination (endedAt) with pauses', () => {
      const membership = getMockMembership();
      // The cycle is normally June 1 to July 1 (30 days)
      const cycleStart = new Date('2024-06-01T00:00:00Z');
      const cycleEnd = new Date('2024-07-01T00:00:00Z');

      // But membership ended on June 20 (19 days into the cycle)
      membership.endedAt = new Date('2024-06-20T00:00:00Z');

      // Pause from June 5 to June 10 (5 days)
      membership.pauses = [
        {
          id: 'pause-june',
          startDate: new Date('2024-06-05T00:00:00Z'),
          endDate: new Date('2024-06-10T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
        new Date('2024-12-31T23:59:59Z'), // season end, but endedAt is earlier
      );

      // End date becomes June 20 (20 days active since we use end of day). Subtract 5 pause days = 15 active days.
      // Expected = 50 * (15/30) = 25
      expect(result.netAmount).toBe(25);
    });

    it('should guarantee a $0 charge when 100% discount (Beca) is combined with pauses', () => {
      const membership = getMockMembership();
      const cycleStart = new Date('2024-04-01T00:00:00Z');
      const cycleEnd = new Date('2024-05-01T00:00:00Z'); // 30 days

      // 100% discount
      membership.studentDiscounts = [
        {
          id: 'discount-1',
          studentMembershipId: membership.id,
          type: 'BECADO',
          reason: 'Beca completa',
          registrationDiscountPercent: 0,
          recurringDiscountPercent: 100,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as any,
      ];

      // Pause for 10 days
      membership.pauses = [
        {
          id: 'pause-1',
          startDate: new Date('2024-04-05T00:00:00Z'),
          endDate: new Date('2024-04-15T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );

      // Base amount would be prorated (50 * 20/30 = 33.33)
      // 100% discount is applied to the prorated base amount.
      expect(result.baseAmount).toBe(33.33);
      expect(result.discountPercent).toBe(100);
      expect(result.netAmount).toBe(0);
    });

    it('should correctly calculate exact days for a leap year February', () => {
      const membership = getMockMembership();
      // Feb 2024 is a leap year (29 days)
      const cycleStart = new Date('2024-02-01T00:00:00Z');
      const cycleEnd = new Date('2024-03-01T00:00:00Z');

      // Pause of 5 days
      membership.courseSeason.pauses = [
        {
          id: 'pause-feb',
          startDate: new Date('2024-02-10T00:00:00Z'),
          endDate: new Date('2024-02-14T00:00:00Z'),
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );
      // net amount logic: base 50
      // formula: (50 / 29) * 25
      const expectedAmount = Number(((50 / 29) * 25).toFixed(2));
      expect(result.netAmount).toBe(expectedAmount);
    });

    it('should ignore pauses completely outside the cycle range', () => {
      const membership = getMockMembership();
      const cycleStart = new Date('2024-05-01T00:00:00Z');
      const cycleEnd = new Date('2024-06-01T00:00:00Z');

      membership.courseSeason.pauses = [
        {
          id: 'past-pause',
          startDate: new Date('2024-03-01T00:00:00Z'),
          endDate: new Date('2024-03-15T00:00:00Z'), // Long in the past
          status: 'ACTIVE',
        } as any,
        {
          id: 'future-pause',
          startDate: new Date('2024-06-01T00:00:00Z'),
          endDate: new Date('2024-06-10T00:00:00Z'), // In the future
          status: 'ACTIVE',
        } as any,
      ];

      const result = calculateRecurringFeeForDate(
        membership,
        cycleStart,
        false,
        cycleEnd,
      );
      expect(result.netAmount).toBe(50); // full amount
    });
  });
});
