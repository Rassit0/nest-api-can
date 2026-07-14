import { 
  calculateRegistrationFee, 
  calculateRecurringFeeForDate,
  calculateSinglePaymentFee,
  PlayerMembershipWithRelations,
  FinancialCalculationResult
} from './membership-financial.calculator';
import { Prisma } from 'src/generated/prisma/client';
import { MILLISECONDS_IN_DAY } from './membership-billing.utils';

describe('MembershipFinancialCalculator', () => {
  const getMockMembership = (): PlayerMembershipWithRelations => {
    return {
      id: 'test-membership',
      playerId: 'player-1',
      teamSeasonId: 'team-season-1',
      paymentPlanId: 'payment-plan-1',
      status: 'ACTIVE',
      startedAt: new Date('2024-01-01T00:00:00Z'),
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
        active: true
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
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: new Date('2024-12-31T23:59:59Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          active: true,
          clubId: 'club-1'
        }
      }
    } as unknown as PlayerMembershipWithRelations;
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
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(20);
      
      const result = calculateRegistrationFee(membership);
      expect(result.baseAmount).toBe(100);
      expect(result.netAmount).toBe(80);
      expect(result.discountPercent).toBe(20);
      expect(result.discountAmount).toBe(20);
      expect(result.appliedDiscounts[0].reason).toBe('Plan de pago');
    });

    it('should cap discount at 100% and result in $0 netAmount', () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(100);
      
      const result = calculateRegistrationFee(membership);
      expect(result.baseAmount).toBe(100);
      expect(result.netAmount).toBe(0);
      expect(result.discountPercent).toBe(100);
      expect(result.discountAmount).toBe(100);
    });

    it('should calculate prorated registration fee correctly', () => {
      const membership = getMockMembership();
      membership.teamSeason.billingConfig!.prorateRegistrationFee = true;
      membership.startedAt = new Date('2024-07-01T00:00:00Z'); // Halfway through the year
      
      const result = calculateRegistrationFee(membership);
      // Roughly half of the year passed, so baseAmount should be ~50
      expect(result.baseAmount).toBeLessThan(100);
      expect(result.baseAmount).toBeGreaterThan(45);
    });

    it('should accumulate custom membership discounts with payment plan discounts', () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(10);
      membership.membershipDiscounts = [
        {
          id: 'discount-1',
          playerMembershipId: membership.id,
          type: 'BECADO',
          reason: 'Beca deportiva',
          registrationDiscountPercent: 20,
          recurringDiscountPercent: 0,
          startDate: new Date('2024-01-01T00:00:00Z'),
          endDate: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as unknown as any
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

      const result = calculateRecurringFeeForDate(membership, dueDate, true, nextDueDate, undefined, theoreticalDueDate);
      
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

      const result = calculateRecurringFeeForDate(membership, dueDate, false, nextDueDate, seasonEnd);
      
      // Should charge for approx 15 days out of 31 days
      expect(result.baseAmount).toBeLessThan(50);
      expect(result.baseAmount).toBeGreaterThan(20);
    });

    it('should apply advance payment discounts', () => {
      const membership = getMockMembership();
      membership.paymentPlan.advanceCycles = 3;
      membership.paymentPlan.advanceCyclesDiscountPercent = new Prisma.Decimal(15);

      // Current cycle = 1 (within advance cycles)
      const resultCycle1 = calculateRecurringFeeForDate(membership, new Date(), false, undefined, undefined, undefined, 1);
      expect(resultCycle1.discountPercent).toBe(15);

      // Current cycle = 4 (outside advance cycles)
      const resultCycle4 = calculateRecurringFeeForDate(membership, new Date(), false, undefined, undefined, undefined, 4);
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
      membership.teamSeason.billingConfig!.prorateSeasonFee = true;
      membership.startedAt = new Date('2024-07-01T00:00:00Z'); // Half season

      const result = calculateSinglePaymentFee(membership, 0, 0);
      
      expect(result.baseAmount).toBeLessThan(500);
      expect(result.baseAmount).toBeGreaterThan(240);
    });

    it('should use accumulated values if no seasonFee is configured', () => {
      const membership = getMockMembership();
      membership.teamSeason.billingConfig!.seasonFee = null;

      const result = calculateSinglePaymentFee(membership, 600, 10);
      
      expect(result.baseAmount).toBe(600);
      expect(result.discountPercent).toBe(10);
      expect(result.netAmount).toBe(540); // 600 - 10%
    });
  });
});
