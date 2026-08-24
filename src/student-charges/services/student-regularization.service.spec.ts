import { Test, TestingModule } from '@nestjs/testing';
import { StudentRegularizationService } from './student-regularization.service';
import { PrismaService } from 'src/prisma.service';
import { StudentCycleManagerService } from './student-cycle-manager.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { TypeMembershipCharge } from 'src/generated/prisma/client';

describe('StudentRegularizationService', () => {
  let service: StudentRegularizationService;
  let prismaService: any;
  let cycleManagerService: any;

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn(async (cb) => {
        return await cb(prismaService);
      }),
      studentMembership: {
        findUnique: jest.fn(),
      },
      studentCharge: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      charge: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mock-charge-id' }),
      },
    };

    cycleManagerService = {
      enrollCyclesToMembership: jest.fn().mockResolvedValue({ generatedCount: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentRegularizationService,
        { provide: PrismaService, useValue: prismaService },
        { provide: StudentCycleManagerService, useValue: cycleManagerService },
      ],
    }).compile();

    service = module.get<StudentRegularizationService>(StudentRegularizationService);
  });

  const getMockMembership = () => ({
    id: 'mem-1',
    courseSeason: {
      season: { 
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
      },
      billingConfig: { 
        billingFrequency: 'MONTHLY',
        recurringFee: 100,
      },
      pauses: []
    },
    studentDiscounts: [],
  });

  describe('regularizeCharge', () => {
    it('debería rechazar regularizar un ciclo futuro (no iniciado)', async () => {
      const mockMembership = getMockMembership();
      prismaService.studentMembership.findUnique.mockResolvedValue(mockMembership);
      
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2); // Un ciclo muy en el futuro
      
      const futureCycleId = `${futureDate.getFullYear()}-${futureDate.getMonth() + 1}-MONTHLY`;

      await expect(service.regularizeCharge('mem-1', { cycleId: futureCycleId })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería regularizar el ciclo histórico usando cycleStartDate como enrollmentDate', async () => {
      const mockMembership = getMockMembership();
      prismaService.studentMembership.findUnique.mockResolvedValue(mockMembership);

      // El ciclo objetivo es agosto (mes 8)
      const targetCycleId = '2026-8-MONTHLY';

      const result = await service.regularizeCharge('mem-1', { cycleId: targetCycleId });

      expect(cycleManagerService.enrollCyclesToMembership).toHaveBeenCalledTimes(1);
      
      const callArgs = cycleManagerService.enrollCyclesToMembership.mock.calls[0];
      // Arg 0: membership
      expect(callArgs[0]).toEqual(mockMembership);
      // Arg 1: array con un ciclo (el de agosto)
      expect(callArgs[1][0].billingMonth).toEqual(8);
      // Arg 2: enrollmentDate (debe ser el cycleStartDate)
      expect(callArgs[2]).toEqual(callArgs[1][0].cycleStartDate);
      
      // options (arg 3) debe no tener overrideChargeAmount
      expect(callArgs[3].overrideChargeAmount).toBeUndefined();
      expect(result).toHaveProperty('id', 'mock-charge-id');
    });

    it('debería regularizar el ciclo con un monto forzado (overrideAmount)', async () => {
      const mockMembership = getMockMembership();
      prismaService.studentMembership.findUnique.mockResolvedValue(mockMembership);

      const targetCycleId = '2026-8-MONTHLY';
      const overrideAmount = 50;

      await service.regularizeCharge('mem-1', { cycleId: targetCycleId, overrideAmount });

      expect(cycleManagerService.enrollCyclesToMembership).toHaveBeenCalledTimes(1);
      const callArgs = cycleManagerService.enrollCyclesToMembership.mock.calls[0];
      
      // options (arg 3) debe tener overrideChargeAmount
      expect(callArgs[3].overrideChargeAmount).toEqual(overrideAmount);
    });

    it('debería lanzar ConflictException si existingCharges ya tiene este ciclo (basado en StudentCharge)', async () => {
      const mockMembership = getMockMembership();
      prismaService.studentMembership.findUnique.mockResolvedValue(mockMembership);

      const targetCycleId = '2026-8-MONTHLY';

      prismaService.studentCharge.findMany.mockResolvedValue([
        { billingYear: 2026, billingMonth: 8, billingCycle: null }
      ]);

      await expect(service.regularizeCharge('mem-1', { cycleId: targetCycleId })).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
