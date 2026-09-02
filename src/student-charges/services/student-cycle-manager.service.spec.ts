import { Test, TestingModule } from '@nestjs/testing';
import { StudentCycleManagerService } from './student-cycle-manager.service';
import { Prisma } from 'src/generated/prisma/client';
import { AbsoluteCycle } from '../student-billing.utils';

// Mock validateCourseSeasonCapacity at the top level
jest.mock('src/common/helpers/capacity.helper', () => ({
  validateCourseSeasonCapacity: jest.fn().mockResolvedValue(true),
}));

describe('StudentCycleManagerService', () => {
  let service: StudentCycleManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentCycleManagerService],
    }).compile();

    service = module.get<StudentCycleManagerService>(StudentCycleManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enrollCyclesToMembership', () => {
    const mockTx: any = {
      cycleEnrollment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ce-1' }),
      },
      charge: {
        create: jest.fn().mockResolvedValue({ id: 'ch-1' }),
      },
      studentCharge: {
        create: jest.fn().mockResolvedValue({ id: 'sch-1' }),
      },
    };

    const seasonEndDate = new Date('2023-12-31T23:59:59.999Z');
    const mockMembership: any = {
      id: 'membership-1',
      courseSeasonId: 'season-1',
      courseSeasonShiftId: 'shift-1',
      startedAt: new Date('2023-08-01T00:00:00.000Z'), // membership antigua
      pauses: [],
      courseSeason: {
        season: {
          endDate: seasonEndDate,
        },
        pauses: [],
        billingConfig: {
          billingFrequency: 'MONTHLY',
          prorateFirstRecurringFee: true,
          prorateLastRecurringFee: true,
          recurringFee: 100,
        },
      },
      paymentPlan: {
        advanceCycles: 1,
      },
    };

    const options = {
      chargeInitialCycle: true,
      isSeasonFeeOnly: false,
      billingFrequency: 'MONTHLY',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('Caso 1: Primer día del ciclo (NO prorrateo, ciclo completo)', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-01T00:00:00.000Z');

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toEqual(100);
      expect(chargeCall.data.description).not.toContain('Prorrateado');
    });

    it('Caso 2: Después del inicio (prorrateo con billableDays menores y monto ajustado)', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toBeLessThan(100);
      expect(chargeCall.data.amount).toBeGreaterThan(0);
      expect(chargeCall.data.description).toContain('Prorrateado');
    });

    it('Caso 3 y 7: Forzar ciclo completo (forceFullCycleFee = true) y effectiveStartDate', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');
      const overrideOptions = { ...options, forceFullCycleFee: true };

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        overrideOptions,
        mockTx,
      );

      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toEqual(100);
      expect(chargeCall.data.description).not.toContain('Prorrateado');

      const enrollmentCall = mockTx.cycleEnrollment.create.mock.calls[0][0];
      expect(enrollmentCall.data.effectiveStartDate).toEqual(enrollmentDate); // 15/09
    });

    it('Caso 4: Ciclo futuro (NO prorrateo, ciclo completo)', async () => {
      const octoberCycle: AbsoluteCycle = {
        cycleCounter: 2,
        cycleStartDate: new Date('2023-10-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-10-31T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 10,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');

      await service.enrollCyclesToMembership(
        mockMembership,
        [octoberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toEqual(100);
      expect(chargeCall.data.description).not.toContain('Prorrateado');
    });

    it('Caso 6: Ciclos discontinuos (Sept + Dic)', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const decemberCycle: AbsoluteCycle = {
        cycleCounter: 4, // Ciclo absoluto 4
        cycleStartDate: new Date('2023-12-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-12-31T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 12,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle, decemberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      // Septiembre: susceptible de prorrateo
      const chargeCallSept = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCallSept.data.amount).toBeLessThan(100);
      expect(chargeCallSept.data.description).toContain('Prorrateado');

      // Diciembre: ciclo completo
      const chargeCallDec = mockTx.charge.create.mock.calls[1][0];
      expect(chargeCallDec.data.amount).toEqual(100);
      expect(chargeCallDec.data.description).not.toContain('Prorrateado');
    });
  });
});
