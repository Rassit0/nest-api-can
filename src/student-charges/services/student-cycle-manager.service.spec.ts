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

    it('Caso 1: Inscripción tardía (prorrateo del ciclo afectado)', async () => {
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

      // Verify CycleEnrollment was created with effectiveStartDate = enrollmentDate
      expect(mockTx.cycleEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectiveStartDate: enrollmentDate,
          }),
        }),
      );

      // Verify Charge was created with a prorated amount (less than 100)
      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toBeGreaterThan(0);
      expect(chargeCall.data.amount).toBeLessThan(100);
      expect(chargeCall.data.description).toContain('Prorrateado');
    });

    it('Caso 2: Ciclo futuro (cobro completo independientemente del enrollmentDate anterior)', async () => {
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

      // effectiveStartDate should be 01/10, NOT 15/09
      expect(mockTx.cycleEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectiveStartDate: octoberCycle.cycleStartDate,
          }),
        }),
      );

      // Verify Charge was created with FULL amount (100)
      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toEqual(100);
      expect(chargeCall.data.description).not.toContain('Prorrateado');
    });

    it('Caso 3: Membership antigua pero enrollmentDate reciente (Reactivación)', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');
      
      // Membership starts on August 1st
      expect(mockMembership.startedAt.getTime()).toBeLessThan(septemberCycle.cycleStartDate.getTime());

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      // effectiveStartDate should be 15/09, ignoring the membership.startedAt of 01/08
      expect(mockTx.cycleEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            effectiveStartDate: enrollmentDate,
          }),
        }),
      );

      // It must be prorated!
      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.description).toContain('Prorrateado');
    });
    it('Caso 4: Si existe un CycleEnrollment CANCELLED, permite nueva inscripción', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z');

      // Setup the mock to simulate that findFirst returns nothing (which means either no enrollment or only CANCELLED exist)
      mockTx.cycleEnrollment.findFirst.mockResolvedValueOnce(null);

      const result = await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        options,
        mockTx,
      );

      // Verify that findFirst was called with the correct filter
      expect(mockTx.cycleEnrollment.findFirst).toHaveBeenCalledWith({
        where: {
          studentMembershipId: mockMembership.id,
          cycleStartDate: septemberCycle.cycleStartDate,
          cycleEndDate: septemberCycle.cycleEndDate,
          status: { not: 'CANCELLED' } // Assuming CycleEnrollmentStatus.CANCELLED is 'CANCELLED'
        }
      });

      expect(result.generatedCount).toBe(1);
    });

    it('Caso 5: Con overrideChargeAmount, no aplica prorrateo y asigna el monto exacto', async () => {
      const septemberCycle: AbsoluteCycle = {
        cycleCounter: 1,
        cycleStartDate: new Date('2023-09-01T00:00:00.000Z'),
        cycleEndDate: new Date('2023-09-30T23:59:59.999Z'),
        billingYear: 2023,
        billingMonth: 9,
        billingCycle: null,
      };

      const enrollmentDate = new Date('2023-09-15T00:00:00.000Z'); // Entrada tardía
      
      const overrideOptions = { ...options, overrideChargeAmount: 150 };

      await service.enrollCyclesToMembership(
        mockMembership,
        [septemberCycle],
        enrollmentDate,
        overrideOptions,
        mockTx,
      );

      // Verify Charge was created with EXACTLY 150 despite late enrollment
      const chargeCall = mockTx.charge.create.mock.calls[0][0];
      expect(chargeCall.data.amount).toEqual(150);
      expect(chargeCall.data.discountAmount).toEqual(0);
      expect(chargeCall.data.description).not.toContain('Prorrateado');
      
      const studentChargeCall = mockTx.studentCharge.create.mock.calls[0][0];
      expect(studentChargeCall.data.createdByCron).toBe(false);
    });
  });
});
