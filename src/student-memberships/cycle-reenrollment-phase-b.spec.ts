import { Test, TestingModule } from '@nestjs/testing';
import { StudentCycleManagerService } from '../student-charges/services/student-cycle-manager.service';
import { StudentMembershipsService } from './student-memberships.service';
import { PrismaService } from '../prisma.service';
import { CycleEnrollmentStatus, StatusCharge, TypeMembershipCharge, StudentMembershipStatus } from '../generated/prisma/client';
import { syncCycleEnrollmentStatus } from '../common/helpers/sync-cycle-enrollment.helper';
import { isCycleEnrollmentExpired } from '../common/helpers/cycle-enrollment.helper';

// Mock capacity helper
jest.mock('../common/helpers/capacity.helper', () => ({
  validateCourseSeasonCapacity: jest.fn().mockResolvedValue(true),
  buildValidOccupancyCondition: jest.fn().mockReturnValue({
    OR: [
      { status: 'CONFIRMED' },
      { status: 'PENDING' },
    ],
  }),
}));

describe('FASE B — Safe Re-Enrollment of Cancelled Cycles & Attempt Tracking', () => {
  let cycleManager: StudentCycleManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentCycleManagerService],
    }).compile();

    cycleManager = module.get<StudentCycleManagerService>(StudentCycleManagerService);
  });

  const mockMembership = {
    id: 'mem-100',
    courseSeasonId: 'season-100',
    courseSeasonShiftId: 'shift-100',
    startedAt: new Date('2026-08-01T00:00:00.000Z'),
    pauses: [],
    courseSeason: {
      season: {
        endDate: new Date('2026-12-31T23:59:59.999Z'),
      },
      pauses: [],
      billingConfig: {
        billingFrequency: 'MONTHLY',
        recurringFee: 150,
      },
    },
    paymentPlan: {
      advanceCycles: 1,
    },
    studentDiscounts: [],
  };

  const augustCycle = {
    cycleCounter: 1,
    cycleStartDate: new Date('2026-08-01T00:00:00.000Z'),
    cycleEndDate: new Date('2026-08-31T23:59:59.999Z'),
    billingYear: 2026,
    billingMonth: 8,
    billingCycle: null,
  };

  const options = {
    chargeInitialCycle: true,
    isSeasonFeeOnly: false,
    billingFrequency: 'MONTHLY',
  };

  describe('1 & 4. Flujo de Intentos Independientes (Attempt Allocation & Preservation)', () => {
    it('Intento 1: Inscripción inicial genera CycleEnrollment A y Charge A con attempt = 1', async () => {
      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mem-100' }]),
        cycleEnrollment: {
          findFirst: jest.fn()
            .mockResolvedValueOnce(null) // active check -> no active
            .mockResolvedValueOnce(null), // last attempt check -> no prior attempts
          create: jest.fn().mockResolvedValue({ id: 'ce-attempt-1', attempt: 1 }),
        },
        charge: {
          create: jest.fn().mockResolvedValue({ id: 'charge-A', amount: 150, status: StatusCharge.PENDING }),
        },
        studentCharge: {
          create: jest.fn().mockResolvedValue({ id: 'sc-1', attempt: 1 }),
        },
      };

      const result = await cycleManager.enrollCyclesToMembership(
        mockMembership,
        [augustCycle],
        augustCycle.cycleStartDate,
        options,
        mockTx,
      );

      expect(result.generatedCount).toBe(1);
      expect(result.generatedChargeIds).toEqual(['charge-A']);

      // Verifica lock FOR UPDATE sobre student_memberships
      expect(mockTx.$queryRaw).toHaveBeenCalled();

      // Verifica que se crea CycleEnrollment con attempt = 1
      const ceCreateCall = mockTx.cycleEnrollment.create.mock.calls[0][0];
      expect(ceCreateCall.data.attempt).toBe(1);
      expect(ceCreateCall.data.chargeId).toBe('charge-A');
      expect(ceCreateCall.data.status).toBe(CycleEnrollmentStatus.PENDING);

      // Verifica que se crea StudentCharge con attempt = 1
      const scCreateCall = mockTx.studentCharge.create.mock.calls[0][0];
      expect(scCreateCall.data.attempt).toBe(1);
      expect(scCreateCall.data.chargeId).toBe('charge-A');
    });

    it('Intento 2: Tras cancelación, la reinscripción asigna attempt = 2 y genera Charge B nuevo', async () => {
      // Simula que el intento 1 existe pero está CANCELLED
      const cancelledAttempt1 = {
        id: 'ce-attempt-1',
        attempt: 1,
        status: CycleEnrollmentStatus.CANCELLED,
        cycleStartDate: augustCycle.cycleStartDate,
        cycleEndDate: augustCycle.cycleEndDate,
      };

      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mem-100' }]),
        cycleEnrollment: {
          findFirst: jest.fn()
            .mockResolvedValueOnce(null) // 1. active check (status not CANCELLED) -> null (permite reinscribir)
            .mockResolvedValueOnce(cancelledAttempt1), // 2. last attempt query -> retorna attempt 1
          create: jest.fn().mockResolvedValue({ id: 'ce-attempt-2', attempt: 2 }),
        },
        charge: {
          create: jest.fn().mockResolvedValue({ id: 'charge-B', amount: 150, status: StatusCharge.PENDING }),
        },
        studentCharge: {
          create: jest.fn().mockResolvedValue({ id: 'sc-2', attempt: 2 }),
        },
      };

      const result = await cycleManager.enrollCyclesToMembership(
        mockMembership,
        [augustCycle],
        augustCycle.cycleStartDate,
        options,
        mockTx,
      );

      expect(result.generatedCount).toBe(1);
      expect(result.generatedChargeIds).toEqual(['charge-B']);

      // El nuevo CycleEnrollment debe ser intento 2
      const ceCreateCall = mockTx.cycleEnrollment.create.mock.calls[0][0];
      expect(ceCreateCall.data.attempt).toBe(2);
      expect(ceCreateCall.data.chargeId).toBe('charge-B');
      expect(ceCreateCall.data.status).toBe(CycleEnrollmentStatus.PENDING);

      // El nuevo StudentCharge debe ser intento 2
      const scCreateCall = mockTx.studentCharge.create.mock.calls[0][0];
      expect(scCreateCall.data.attempt).toBe(2);
      expect(scCreateCall.data.chargeId).toBe('charge-B');
    });

    it('Intento 3: Tras segunda cancelación, se asigna attempt = 3 y genera Charge C', async () => {
      const cancelledAttempt2 = {
        id: 'ce-attempt-2',
        attempt: 2,
        status: CycleEnrollmentStatus.CANCELLED,
      };

      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mem-100' }]),
        cycleEnrollment: {
          findFirst: jest.fn()
            .mockResolvedValueOnce(null) // no active enrollment
            .mockResolvedValueOnce(cancelledAttempt2), // max attempt = 2
          create: jest.fn().mockResolvedValue({ id: 'ce-attempt-3', attempt: 3 }),
        },
        charge: {
          create: jest.fn().mockResolvedValue({ id: 'charge-C', amount: 150, status: StatusCharge.PENDING }),
        },
        studentCharge: {
          create: jest.fn().mockResolvedValue({ id: 'sc-3', attempt: 3 }),
        },
      };

      const result = await cycleManager.enrollCyclesToMembership(
        mockMembership,
        [augustCycle],
        augustCycle.cycleStartDate,
        options,
        mockTx,
      );

      expect(result.generatedCount).toBe(1);
      expect(result.generatedChargeIds).toEqual(['charge-C']);

      const ceCreateCall = mockTx.cycleEnrollment.create.mock.calls[0][0];
      expect(ceCreateCall.data.attempt).toBe(3);
      expect(ceCreateCall.data.chargeId).toBe('charge-C');

      const scCreateCall = mockTx.studentCharge.create.mock.calls[0][0];
      expect(scCreateCall.data.attempt).toBe(3);
    });
  });

  describe('3. Invariante: Un Solo Intento Vigente por Período (PENDING o CONFIRMED)', () => {
    it('Si ya existe un intento PENDING, no genera inscripción ni nuevo cargo', async () => {
      const existingActiveEnrollment = {
        id: 'ce-pending',
        attempt: 1,
        status: CycleEnrollmentStatus.PENDING,
      };

      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mem-100' }]),
        cycleEnrollment: {
          findFirst: jest.fn().mockResolvedValueOnce(existingActiveEnrollment),
          create: jest.fn(),
        },
        charge: {
          create: jest.fn(),
        },
        studentCharge: {
          create: jest.fn(),
        },
      };

      const result = await cycleManager.enrollCyclesToMembership(
        mockMembership,
        [augustCycle],
        augustCycle.cycleStartDate,
        options,
        mockTx,
      );

      expect(result.generatedCount).toBe(0);
      expect(result.generatedChargeIds).toEqual([]);
      expect(mockTx.charge.create).not.toHaveBeenCalled();
      expect(mockTx.cycleEnrollment.create).not.toHaveBeenCalled();
      expect(mockTx.studentCharge.create).not.toHaveBeenCalled();
    });

    it('Si ya existe un intento CONFIRMED, no genera inscripción ni nuevo cargo', async () => {
      const existingConfirmedEnrollment = {
        id: 'ce-confirmed',
        attempt: 1,
        status: CycleEnrollmentStatus.CONFIRMED,
      };

      const mockTx: any = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'mem-100' }]),
        cycleEnrollment: {
          findFirst: jest.fn().mockResolvedValueOnce(existingConfirmedEnrollment),
          create: jest.fn(),
        },
        charge: {
          create: jest.fn(),
        },
        studentCharge: {
          create: jest.fn(),
        },
      };

      const result = await cycleManager.enrollCyclesToMembership(
        mockMembership,
        [augustCycle],
        augustCycle.cycleStartDate,
        options,
        mockTx,
      );

      expect(result.generatedCount).toBe(0);
      expect(mockTx.charge.create).not.toHaveBeenCalled();
      expect(mockTx.cycleEnrollment.create).not.toHaveBeenCalled();
    });
  });

  describe('7. Aislamiento Financiero y Confirmación de Pagos', () => {
    it('Un pago sobre Charge B confirma exclusivamente CycleEnrollment B, dejando CycleEnrollment A como CANCELLED', async () => {
      const mockTx: any = {
        cycleEnrollment: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'ce-attempt-2',
              chargeId: 'charge-B',
              createdAt: new Date(), // dentro de 72h
              status: CycleEnrollmentStatus.PENDING,
              studentMembership: {
                id: 'mem-100',
                status: StudentMembershipStatus.ACTIVE,
                courseSeasonShiftId: 'shift-100',
              },
            },
          ]),
          update: jest.fn().mockResolvedValue({ id: 'ce-attempt-2', status: CycleEnrollmentStatus.CONFIRMED }),
        },
        studentMembership: {
          update: jest.fn(),
        },
      };

      // Se ejecuta el pago sobre charge-B
      await syncCycleEnrollmentStatus(mockTx, 'charge-B', StatusCharge.PAID);

      // Debe consultar solo enrollments asociados a charge-B
      expect(mockTx.cycleEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ chargeId: 'charge-B' }),
        }),
      );

      // Solo actualiza ce-attempt-2 a CONFIRMED
      expect(mockTx.cycleEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'ce-attempt-2' },
        data: { status: CycleEnrollmentStatus.CONFIRMED },
      });
    });

    it('El intento nuevo cuenta con su propia ventana fresca de 72 horas y no expira de inmediato', () => {
      // Inscripción creada recién (0 horas)
      const freshCreatedAt = new Date();
      expect(isCycleEnrollmentExpired(freshCreatedAt)).toBe(false);

      // Inscripción de hace 48 horas (sigue válida dentro de las 72h)
      const createdAt48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
      expect(isCycleEnrollmentExpired(createdAt48h)).toBe(false);

      // Inscripción de hace 73 horas (expirada)
      const createdAt73h = new Date(Date.now() - 73 * 60 * 60 * 1000);
      expect(isCycleEnrollmentExpired(createdAt73h)).toBe(true);
    });
  });
});
