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

describe('StudentAdvanceChargeService (FASE 2.7 - On-Demand Purchase Future Cycles)', () => {
  let service: StudentAdvanceChargeService;
  let prismaService: any;
  let membershipRepo: any;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn(async (cb) => {
        return await cb(prismaService);
      }),
      $queryRaw: jest.fn().mockResolvedValue([{ maxMembers: null }]),
      cycleEnrollment: {
        findMany: jest.fn(),
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
      ],
    }).compile();

    service = module.get<StudentAdvanceChargeService>(StudentAdvanceChargeService);
  });

  const getMockMembership = (overrides = {}) => ({
    id: 'mem-1',
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
        { cycleStartDate: new Date('2026-11-01T00:00:00.000Z'), cycleEndDate: new Date('2026-12-01T00:00:00.000Z') },
        { cycleStartDate: new Date('2026-12-01T00:00:00.000Z'), cycleEndDate: new Date('2027-01-01T00:00:00.000Z') },
      ]);

      const result = await service.previewAdvanceCharges('mem-1', 1);
      expect(result.charges.length).toBe(0);
    });

    it('should preview 2 future cycles and ignore previous ones', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      // Only August is enrolled
      prismaService.cycleEnrollment.findMany.mockResolvedValue([
        { cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') },
      ]);

      const result = await service.previewAdvanceCharges('mem-1', 2);
      expect(result.charges.length).toBe(2);
      expect(result.charges[0].cycleStartDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(result.charges[1].cycleStartDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
      
      // effectiveStart must be equal to cycleStartDate (no late entry inheritance)
      expect(result.charges[0].effectiveStartDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(result.charges[1].effectiveStartDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('should ignore an exonerated cycle (CycleEnrollment exists but without Charge)', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      
      // Simulate that August was exonerated. The student HAS the CycleEnrollment for August.
      // Notice we don't even return Charge info here because the service DOES NOT query it.
      prismaService.cycleEnrollment.findMany.mockResolvedValue([
        { cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') },
      ]);

      const result = await service.previewAdvanceCharges('mem-1', 1);
      
      // It should skip August and offer September, proving that the exoneration
      // is respected just by the presence of CycleEnrollment.
      expect(result.charges.length).toBe(1);
      expect(result.charges[0].cycleStartDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    });
  });

  describe('purchaseAdvanceCycles', () => {
    it('should successfully generate explicitly 2 charges for future cycles', async () => {
      const mockMembership = getMockMembership();
      membershipRepo.getMembershipOrThrow.mockResolvedValue(mockMembership);
      prismaService.cycleEnrollment.findMany.mockResolvedValue([
        { cycleStartDate: new Date('2026-08-01T00:00:00.000Z'), cycleEndDate: new Date('2026-09-01T00:00:00.000Z') },
      ]);

      const result = await service.purchaseAdvanceCycles('mem-1', 2);

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

      await expect(service.purchaseAdvanceCycles('mem-1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
