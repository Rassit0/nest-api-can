import { Test, TestingModule } from '@nestjs/testing';
import { StudentAdvanceChargeService } from './student-advance-charge.service';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { BadRequestException } from '@nestjs/common';
import {
  SeasonStatus,
  StatusCourseSeason,
  SeasonBillingType,
} from 'src/generated/prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { StudentCycleManagerService } from './student-cycle-manager.service';

describe('StudentAdvanceChargeService (FASE 2.7 - On-Demand Purchase Future Cycles)', () => {
  let service: StudentAdvanceChargeService;
  let prismaService: any;
  let membershipRepo: any;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));

    prismaService = {
      $transaction: jest.fn(async (cb) => {
        return await cb(prismaService);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ maxMembers: null }]),
      cycleEnrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      charge: {
        create: jest.fn().mockImplementation((data) => ({ id: 'mock-charge-id', ...data.data })),
      },
      studentCharge: {
        create: jest.fn(),
      }
    };

    membershipRepo = {
      getMembershipOrThrow: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentAdvanceChargeService,
        { provide: PrismaService, useValue: prismaService },
        { provide: StudentMembershipRepository, useValue: membershipRepo },
        StudentCycleManagerService,
      ],
    }).compile();

    service = module.get<StudentAdvanceChargeService>(StudentAdvanceChargeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const getMockMembership = (overrides = {}) => ({
    id: 'mem-1',
    startedAt: new Date('2026-08-01T00:00:00.000Z'),
    courseSeason: {
      status: StatusCourseSeason.ACTIVE,
      season: { 
        status: SeasonStatus.ACTIVE,
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
      },
      billingConfig: { 
        billingType: SeasonBillingType.MONTHLY_ONLY,
        billingFrequency: 'MONTHLY',
        isEngineActive: true,
        recurringFee: 100,
        registrationFee: 0,
      },
      pauses: []
    },
    paymentPlan: { isSinglePayment: false, advanceCycles: 1 },
    pauses: [],
    studentDiscounts: [],
    ...overrides,
  });

  describe('previewAdvanceCharges', () => {
    it('should return empty if no cycles left', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      // Mock that all 5 months are already enrolled
      prismaService.cycleEnrollment.findMany.mockResolvedValue([
        { cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') },
        { cycleStartDate: new Date('2026-09-01T00:00:00.000Z'), cycleEndDate: new Date('2026-10-01T00:00:00.000Z') },
        { cycleStartDate: new Date('2026-10-01T00:00:00.000Z'), cycleEndDate: new Date('2026-11-01T00:00:00.000Z') },
        { cycleStartDate: new Date('2026-11-01T00:00:00.000Z'), cycleEndDate: { cycleStartDate: new Date('2026-12-01T00:00:00.000Z') } },
        { cycleStartDate: { cycleStartDate: new Date('2026-12-01T00:00:00.000Z') }, cycleEndDate: new Date('2027-01-01T00:00:00.000Z') },
      ]);

      await expect(service.previewAdvanceCharges('mem-1', [{ cycleStartDate: new Date('2026-08-01T00:00:00.000Z') }])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preview 2 future cycles and ignore previous ones', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      // Only August is enrolled, so if the query is for Sept/Oct, it returns empty
      prismaService.cycleEnrollment.findMany.mockImplementation((args) => {
        if (args?.where?.cycleStartDate?.in?.some(d => d.getTime() === new Date('2026-08-01T00:00:00.000Z').getTime())) {
          return Promise.resolve([{ cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') }]);
        }
        return Promise.resolve([]);
      });

      const result = await service.previewAdvanceCharges('mem-1', [
        { cycleStartDate: new Date('2026-09-01T00:00:00.000Z') }, 
        { cycleStartDate: new Date('2026-10-01T00:00:00.000Z') }
      ]);
      expect(result.charges.length).toBe(2);
      expect(result.charges[0].cycleStartDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(result.charges[1].cycleStartDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
      
      // effectiveStart must be equal to cycleStartDate (no late entry inheritance) for future cycles
      expect(result.charges[0].effectiveStartDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(result.charges[1].effectiveStartDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('should allow purchasing a cycle that was previously CANCELLED', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      
      prismaService.cycleEnrollment.findMany.mockResolvedValue([]);

      await service.previewAdvanceCharges('mem-1', [{ cycleStartDate: new Date('2026-09-01T00:00:00.000Z') }]);
      
      expect(prismaService.cycleEnrollment.findMany).toHaveBeenCalledWith({
        where: {
          studentMembershipId: 'mem-1',
          status: { not: 'CANCELLED' },
          cycleStartDate: { in: [{ cycleStartDate: new Date('') }] }
        },
        select: { cycleStartDate: true, cycleEndDate: true }
      });
    });
  });

  describe('purchaseAdvanceCycles', () => {
    it('should successfully generate explicitly 2 charges for future cycles', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      prismaService.cycleEnrollment.findMany.mockImplementation((args) => {
        if (args?.where?.cycleStartDate?.in?.some(d => d.getTime() === new Date('2026-08-01T00:00:00.000Z').getTime())) {
          return Promise.resolve([{ cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') }]);
        }
        return Promise.resolve([]);
      });

      const result = await service.purchaseAdvanceCycles('mem-1', [{ cycleStartDate: new Date('') }, { cycleStartDate: new Date('') }]);

      expect(prismaService.charge.create).toHaveBeenCalledTimes(2);
      expect(prismaService.cycleEnrollment.create).toHaveBeenCalledTimes(2);
      expect(result.message).toContain('exitosamente 2 cuotas');
    });

    it('should handle unique constraint violations correctly for concurrency', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      prismaService.cycleEnrollment.findMany.mockResolvedValue([]);
      
      const error = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
        meta: { target: ['unique_index'] }
      });

      prismaService.charge.create.mockRejectedValue(error);

      await expect(service.purchaseAdvanceCycles('mem-1', [{ cycleStartDate: new Date('') }, { cycleStartDate: new Date('') }])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if dates are duplicated in the request', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      
      await expect(service.purchaseAdvanceCycles('mem-1', [{ cycleStartDate: new Date('') }, { cycleStartDate: new Date('') }])).rejects.toThrow(BadRequestException);
      
      // Ensure it doesn't even try to reach the database for findMany since it fails early
      expect(prismaService.cycleEnrollment.findMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if date is invalid (does not match any cycle)', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      
      await expect(service.purchaseAdvanceCycles('mem-1', [
        { cycleStartDate: new Date('2026-09-15T00:00:00.000Z') } // 15th is not a start of the month
      ])).rejects.toThrow(BadRequestException);
    });
  });
});
