import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { StudentChargesService } from './student-charges.service';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';
import { StudentManualChargeService } from './services/student-manual-charge.service';
import { StudentAdvanceChargeService } from './services/student-advance-charge.service';
import { StudentEnrollmentService } from './services/student-enrollment.service';

describe('StudentChargesService (previewCharges & discounts)', () => {
  let service: StudentChargesService;
  let membershipRepoMock: {
    getCourseSeasonOrThrow: jest.Mock;
    getPaymentPlanOrThrow: jest.Mock;
  };

  const singleCourseSeason = {
    id: 'cs-single-1',
    status: 'ACTIVE',
    season: {
      startDate: new Date('2026-08-01T04:00:00.000Z'),
      endDate: new Date('2026-12-31T04:00:00.000Z'),
    },
    billingConfig: {
      billingType: 'SINGLE_ONLY',
      billingFrequency: 'MONTHLY',
      seasonFee: 1000,
      recurringFee: 0,
      registrationFee: 0,
      prorateFirstRecurringFee: true,
    },
    pauses: [],
  };

  const singlePaymentPlan = {
    id: 'plan-single-1',
    isSinglePayment: true,
    advanceCycles: 1,
    registrationDiscountPercent: 0,
    recurringDiscountPercent: 0,
    seasonFeeDiscountPercent: 10,
  };

  beforeEach(async () => {
    membershipRepoMock = {
      getCourseSeasonOrThrow: jest.fn().mockResolvedValue(singleCourseSeason),
      getPaymentPlanOrThrow: jest.fn().mockResolvedValue(singlePaymentPlan),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentChargesService,
        StudentPreviewService,
        { provide: PrismaService, useValue: {} },
        { provide: StudentMembershipRepository, useValue: membershipRepoMock },
        { provide: StudentChargeRepository, useValue: {} },
        { provide: StudentManualChargeService, useValue: {} },
        { provide: StudentAdvanceChargeService, useValue: {} },
        { provide: StudentEnrollmentService, useValue: {} },
      ],
    }).compile();

    service = module.get<StudentChargesService>(StudentChargesService);
  });

  it('aplica descuento excepcional usando la propiedad canónica studentDiscounts en SINGLE_ONLY', async () => {
    const result = await service.previewCharges({
      courseSeasonId: 'cs-single-1',
      paymentPlanId: 'plan-single-1',
      startDate: '2026-08-01T04:00:00.000Z',
      studentDiscounts: [
        {
          registrationDiscountPercent: 0,
          recurringDiscountPercent: 0,
          seasonFeeDiscountPercent: 25,
          startDate: '2026-08-01T04:00:00.000Z',
        },
      ],
    });

    expect(result.charges).toHaveLength(1);
    const charge = result.charges[0];
    // Plan 10% + excepcional 25% = 35% sobre 1000 => 650
    expect(charge.type).toBe('SEASON_FEE');
    expect(charge.baseAmount).toBe(1000);
    expect(charge.discountPercent).toBe(35);
    expect(charge.adjustmentAmount).toBe(-350);
    expect(charge.amount).toBe(650);
    expect(result.breakdown.totalBaseAmount).toBe(1000);
    expect(result.breakdown.totalDiscount).toBe(-350);
    expect(result.breakdown.totalNetAmount).toBe(650);
  });

  it('acepta membershipDiscounts como alias legado y lo normaliza a studentDiscounts', async () => {
    const result = await service.previewCharges({
      courseSeasonId: 'cs-single-1',
      paymentPlanId: 'plan-single-1',
      startDate: '2026-08-01T04:00:00.000Z',
      membershipDiscounts: [
        {
          registrationDiscountPercent: 0,
          recurringDiscountPercent: 0,
          seasonFeeDiscountPercent: 20,
          startDate: '2026-08-01T04:00:00.000Z',
        },
      ],
    });

    // Plan 10% + alias legado 20% = 30% sobre 1000 => 700
    expect(result.charges[0].discountPercent).toBe(30);
    expect(result.charges[0].amount).toBe(700);
    expect(result.breakdown.totalDiscount).toBe(-300);
    expect(result.breakdown.totalNetAmount).toBe(700);
  });

  it('rechaza explícitamente solicitudes que envían studentDiscounts y membershipDiscounts simultáneamente', async () => {
    await expect(
      service.previewCharges({
        courseSeasonId: 'cs-single-1',
        paymentPlanId: 'plan-single-1',
        startDate: '2026-08-01T04:00:00.000Z',
        studentDiscounts: [
          {
            registrationDiscountPercent: 0,
            recurringDiscountPercent: 0,
            seasonFeeDiscountPercent: 10,
            startDate: '2026-08-01T04:00:00.000Z',
          },
        ],
        membershipDiscounts: [
          {
            registrationDiscountPercent: 0,
            recurringDiscountPercent: 0,
            seasonFeeDiscountPercent: 20,
            startDate: '2026-08-01T04:00:00.000Z',
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('topa la suma de descuentos en 100% y nunca produce montos negativos', async () => {
    const result = await service.previewCharges({
      courseSeasonId: 'cs-single-1',
      paymentPlanId: 'plan-single-1',
      startDate: '2026-08-01T04:00:00.000Z',
      studentDiscounts: [
        {
          registrationDiscountPercent: 0,
          recurringDiscountPercent: 0,
          seasonFeeDiscountPercent: 95,
          startDate: '2026-08-01T04:00:00.000Z',
        },
      ],
    });

    // Plan 10% + excepcional 95% = 105% -> tope 100% -> 0
    expect(result.charges[0].discountPercent).toBe(100);
    expect(result.charges[0].amount).toBe(0);
    expect(result.breakdown.totalDiscount).toBe(-1000);
    expect(result.breakdown.totalNetAmount).toBe(0);
  });

  it('mantiene intacto el flujo recurrente MONTHLY_ONLY con studentDiscounts', async () => {
    membershipRepoMock.getCourseSeasonOrThrow.mockResolvedValue({
      ...singleCourseSeason,
      id: 'cs-monthly-1',
      billingConfig: {
        billingType: 'MONTHLY_ONLY',
        billingFrequency: 'MONTHLY',
        seasonFee: 0,
        recurringFee: 200,
        registrationFee: 0,
        prorateFirstRecurringFee: false,
      },
    });
    membershipRepoMock.getPaymentPlanOrThrow.mockResolvedValue({
      id: 'plan-monthly-1',
      isSinglePayment: false,
      advanceCycles: 1,
      registrationDiscountPercent: 0,
      recurringDiscountPercent: 0,
      seasonFeeDiscountPercent: 0,
    });

    const result = await service.previewCharges({
      courseSeasonId: 'cs-monthly-1',
      paymentPlanId: 'plan-monthly-1',
      startDate: '2026-08-01T04:00:00.000Z',
      studentDiscounts: [
        {
          registrationDiscountPercent: 0,
          recurringDiscountPercent: 15,
          seasonFeeDiscountPercent: 0,
          startDate: '2026-08-01T04:00:00.000Z',
        },
      ],
    });

    expect(result.charges).toHaveLength(1);
    expect(result.charges[0].type).toBe('RECURRING_FEE');
    expect(result.charges[0].amount).toBe(170);
  });
});
