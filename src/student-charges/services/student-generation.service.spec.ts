import { Test, TestingModule } from '@nestjs/testing';
import { StudentGenerationService } from './student-generation.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentChargeRepository } from '../repositories/student-charge.repository';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipWithRelations } from '../student-financial.calculator';
import { Prisma, TypeMembershipCharge , StatusCourseSeason } from 'src/generated/prisma/client';
import { ExistingChargeMinimal } from '../interfaces/student-charge.types';

describe('StudentGenerationService', () => {
  let service: StudentGenerationService;
  let chargeRepo: jest.Mocked<StudentChargeRepository>;
  let membershipRepo: jest.Mocked<StudentMembershipRepository>;

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

  const mockTx = { charge: { create: jest.fn().mockResolvedValue({ id: 'mock-charge-1' }) } } as unknown as Prisma.TransactionClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentGenerationService,
        {
          provide: StudentMembershipRepository,
          useValue: {
            updateNextGenerationPointer: jest.fn().mockResolvedValue(true)
          }
        },
        {
          provide: StudentChargeRepository,
          useValue: {
            checkRegistrationChargeExists: jest.fn().mockResolvedValue(false),
            checkSeasonChargeExists: jest.fn().mockResolvedValue(false),
            fetchExistingCharges: jest.fn().mockResolvedValue([])
          }
        },
        {
          provide: PrismaService,
          useValue: {}
        }
      ],
    }).compile();

    service = module.get<StudentGenerationService>(StudentGenerationService);
    chargeRepo = module.get(StudentChargeRepository);
    membershipRepo = module.get(StudentMembershipRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureRegistrationCharge', () => {
    it('should generate registration charge if base > 0', async () => {
      const membership = getMockMembership();
      await service.ensureRegistrationCharge(mockTx, membership);
      
      expect(chargeRepo.checkRegistrationChargeExists).toHaveBeenCalledWith(mockTx, membership.id, 2024, 1);
      expect(mockTx.charge.create).toHaveBeenCalled();
      const payload = (mockTx.charge.create as jest.Mock).mock.calls[0][0].data;
      expect(payload.amount).toBe(100);
      expect(payload.studentCharges.create.type).toBe(TypeMembershipCharge.REGISTRATION);
    });

    it('should not generate registration charge if base == 0', async () => {
      const membership = getMockMembership();
      membership.courseSeason.billingConfig!.registrationFee = new Prisma.Decimal(0);
      await service.ensureRegistrationCharge(mockTx, membership);
      
      expect(mockTx.charge.create).not.toHaveBeenCalled();
    });

    it('should generate a $0 registration charge if base > 0 but discount is 100%', async () => {
      const membership = getMockMembership();
      membership.paymentPlan.registrationDiscountPercent = new Prisma.Decimal(100);
      await service.ensureRegistrationCharge(mockTx, membership);
      
      expect(mockTx.charge.create).toHaveBeenCalled();
      const payload = (mockTx.charge.create as jest.Mock).mock.calls[0][0].data;
      expect(payload.amount).toBe(0);
    });
  });

  describe('ensureRecurringCharges', () => {
    it('should generate first recurring charge immediately for new membership', async () => {
      const membership = getMockMembership();
      const evaluationDate = new Date(Date.UTC(2024, 0, 15)); // Same day as startedAt
      
      await service.ensureRecurringCharges(mockTx, membership, evaluationDate);
      
      expect(mockTx.charge.create).toHaveBeenCalledTimes(1);
      const payload = (mockTx.charge.create as jest.Mock).mock.calls[0][0].data;
      expect(payload.studentCharges.create.type).toBe(TypeMembershipCharge.RECURRING_FEE);
      
      // Also updates the pointer
      expect(membershipRepo.updateNextGenerationPointer).toHaveBeenCalled();
      const pointerPassed = membershipRepo.updateNextGenerationPointer.mock.calls[0][2];
      expect(pointerPassed!.getTime()).toBeGreaterThan(evaluationDate.getTime()); // next cycle is Feb 1, minus 7 days = Jan 25
    });

    it('should correctly handle $0 recurring fee if discount is 100%', async () => {
      const membership = getMockMembership();
      membership.paymentPlan.recurringDiscountPercent = new Prisma.Decimal(100);
      const evaluationDate = new Date(Date.UTC(2024, 0, 15)); 
      
      await service.ensureRecurringCharges(mockTx, membership, evaluationDate);
      
      expect(mockTx.charge.create).toHaveBeenCalledTimes(1);
      const payload = (mockTx.charge.create as jest.Mock).mock.calls[0][0].data;
      expect(payload.amount).toBe(0); // 100% discount
    });

    it('should not generate recurring charge if pointer evaluates to a date in future', async () => {
      const membership = getMockMembership();
      // Suppose first cycle was already generated, next pointer is set.
      membership.nextRecurringChargeGenerationDate = new Date(Date.UTC(2024, 0, 25)); 
      
      chargeRepo.fetchExistingCharges.mockResolvedValueOnce([
        { billingYear: 2024, billingMonth: 1, billingCycle: null } as unknown as ExistingChargeMinimal
      ]);

      // Today is Jan 20
      const evaluationDate = new Date(Date.UTC(2024, 0, 20)); 
      
      await service.ensureRecurringCharges(mockTx, membership, evaluationDate);
      
      // Should not create anything
      expect(mockTx.charge.create).not.toHaveBeenCalled();
    });

    it('should generate multiple cycles if evaluationDate is far in the future', async () => {
      const membership = getMockMembership();
      const evaluationDate = new Date(Date.UTC(2024, 2, 10)); // March 10
      
      await service.ensureRecurringCharges(mockTx, membership, evaluationDate);
      
      // Jan 15 (generated immediately)
      // Feb 1 (pointer is Jan 25)
      // Mar 1 (pointer is Feb ~22)
      // So all three should be generated!
      expect(mockTx.charge.create).toHaveBeenCalledTimes(3);
    });

    it('should generate all recurring charges at once for a full payment plan (isSinglePayment = true)', async () => {
      const membership = getMockMembership();
      membership.paymentPlan.isSinglePayment = true;
      const evaluationDate = new Date(Date.UTC(2024, 5, 10)); 
      
      await service.ensureRecurringCharges(mockTx, membership, evaluationDate);
      
      // All 12 monthly charges should be created immediately, bypassing evaluationDate
      expect(mockTx.charge.create).toHaveBeenCalledTimes(12);
      const payload = (mockTx.charge.create as jest.Mock).mock.calls[0][0].data;
      expect(payload.studentCharges.create.type).toBe(TypeMembershipCharge.RECURRING_FEE);

      // Pointer should be null because all charges for the season are generated
      expect(membershipRepo.updateNextGenerationPointer).toHaveBeenCalledWith(mockTx, membership.id, null);
    });
  });
});



