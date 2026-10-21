import { Test, TestingModule } from '@nestjs/testing';
import { ChargesService } from './charges.service';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

jest.mock('src/common/helpers/sync-cycle-enrollment.helper', () => ({
  syncCycleEnrollmentStatus: jest.fn(),
}));

describe('FASES B y C — Integración de Ajustes y Cancelación de Ciclos', () => {
  let service: ChargesService;
  let prisma: any;
  let updateDataSpy: any;

  beforeEach(async () => {
    updateDataSpy = jest.fn().mockImplementation((args) => Promise.resolve({ id: 'test-id', ...args.data }));

    const mockPrismaService = {
      charge: {
        findUnique: jest.fn(),
        update: updateDataSpy,
      },
      sessionBooking: {
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (callback) => {
        return callback({
          charge: {
            update: updateDataSpy,
          },
          sessionBooking: {
            count: jest.fn().mockResolvedValue(0),
          },
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'test-id' }]),
          $executeRawUnsafe: jest.fn().mockResolvedValue(1),
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChargesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChargesService>(ChargesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Ajustes Parciales (Garantía de Preservación de Estado)', () => {
    it('Si un cargo de 300 recibe un ajuste de -50, el saldo es 250 y el ciclo continúa PENDING', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      const result = await service.addAdjustment('charge-1', {
        adjustmentAmount: -50,
        adjustmentReason: 'Descuento parcial por promoción',
      });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -50,
            pendingAmount: 250,
            status: StatusCharge.PENDING,
          }),
        }),
      );
      expect(result.data.status).toBe(StatusCharge.PENDING);
    });
  });

  describe('2. Ajuste Total Ambiguo vs Beca Autorizada (Fase B)', () => {
    it('Si el ajuste reduce a cero un ciclo PENDING sin isScholarship, se rechaza con error explícito', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await expect(
        service.addAdjustment('charge-1', {
          adjustmentAmount: -300,
          adjustmentReason: 'Reducción a cero sin especificar intención',
        }),
      ).rejects.toThrow(
        /Para anular una inscripción de ciclo por error o desistimiento, utilice la opción "Cancelar cargo e inscripción"/,
      );
    });

    it('Si se activa isScholarship: true, el cargo queda liquidado con [BECA 100%] y status PAID', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await service.addAdjustment('charge-1', {
        adjustmentAmount: -300,
        adjustmentReason: 'Beca completa autorizada por dirección deportiva',
        isScholarship: true,
      });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -300,
            adjustmentReason: '[BECA 100%] Beca completa autorizada por dirección deportiva',
            pendingAmount: 0,
            status: StatusCharge.PAID,
          }),
        }),
      );
    });

    it('Si se activa isScholarship: true y el motivo no menciona beca, se etiqueta como [DESCUENTO TOTAL AUTORIZADO]', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await service.addAdjustment('charge-1', {
        adjustmentAmount: -300,
        adjustmentReason: 'Descuento total autorizado por Gerencia General',
        isScholarship: true,
      });

      expect(updateDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -300,
            adjustmentReason: '[DESCUENTO TOTAL AUTORIZADO] Descuento total autorizado por Gerencia General',
            pendingAmount: 0,
            status: StatusCharge.PAID,
          }),
        }),
      );
    });

    it('Exige motivo o justificación obligatoria al aplicar un descuento total', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await expect(
        service.addAdjustment('charge-1', {
          adjustmentAmount: -300,
          adjustmentReason: '   ',
          isScholarship: true,
        }),
      ).rejects.toThrow(/El motivo o justificación de la autorización es obligatorio al aplicar un descuento total/);
    });

    it('No se permite aplicar Beca Total a un ciclo que ya cuenta con pagos registrados', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 200,
        status: StatusCharge.PARTIAL,
        payments: [{ amount: 100, status: 'COMPLETED' }],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await expect(
        service.addAdjustment('charge-1', {
          adjustmentAmount: -300,
          adjustmentReason: 'Beca tardía',
          isScholarship: true,
        }),
      ).rejects.toThrow(/No se puede aplicar un descuento total o beca a un ciclo que ya cuenta con pagos registrados/);
    });

    it('Bloquea ajuste si existen pagos en procesamiento o pendientes de confirmación', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 300,
        status: StatusCharge.PENDING,
        payments: [{ amount: 300, status: 'PROCESSING' }],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.PENDING,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      await expect(
        service.addAdjustment('charge-1', {
          adjustmentAmount: -300,
          adjustmentReason: 'Descuento con pago en proceso',
          isScholarship: true,
        }),
      ).rejects.toThrow(/No se puede aplicar un ajuste a un cargo que tiene pagos en procesamiento/);
    });
  });

  describe('3. Protección de Ciclos Cancelados (Fase E)', () => {
    it('No se permite agregar ajustes a un cargo perteneciente a un ciclo cancelado', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: 0,
        pendingAmount: 0,
        status: StatusCharge.CANCELLED,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.CANCELLED,
        },
      });

      await expect(
        service.addAdjustment('charge-1', { adjustmentAmount: -100 }),
      ).rejects.toThrow(/No se puede modificar un cargo cancelado/);
    });
  });

  describe('4. Seguridad y Protección de removeAdjustment (Fase D y 6)', () => {
    it('Bloquea el retiro de beca si el estudiante ya cuenta con asistencias registradas', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: -300,
        pendingAmount: 0,
        status: StatusCharge.PAID,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.CONFIRMED,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() + 86400000),
          cycleEndDate: new Date(Date.now() + 86400000 * 30),
          studentMembership: { studentId: 'student-1' },
        },
      });

      prisma.sessionBooking.count.mockResolvedValue(1);

      await expect(service.removeAdjustment('charge-1')).rejects.toThrow(
        /asistencias registradas. Requiere regularización administrativa/,
      );
    });

    it('Bloquea el retiro de beca si el período ya inició o finalizó', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: -300,
        pendingAmount: 0,
        status: StatusCharge.PAID,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.CONFIRMED,
          createdAt: new Date(),
          cycleStartDate: new Date(Date.now() - 86400000), // Fecha en el pasado
          cycleEndDate: new Date(Date.now() + 86400000 * 20),
          studentMembership: { studentId: 'student-1' },
        },
      });

      prisma.sessionBooking.count.mockResolvedValue(0);

      await expect(service.removeAdjustment('charge-1')).rejects.toThrow(
        /período ya inició o ha finalizado. Requiere regularización administrativa/,
      );
    });

    it('Bloquea el retiro de beca si el plazo original de 72h ya expiró (evita cancelación inmediata por cron)', async () => {
      prisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: 300,
        adjustmentAmount: -300,
        pendingAmount: 0,
        status: StatusCharge.PAID,
        payments: [],
        cycleEnrollment: {
          id: 'cycle-1',
          status: CycleEnrollmentStatus.CONFIRMED,
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 días atrás (> 72h)
          cycleStartDate: new Date(Date.now() + 86400000 * 5),
          cycleEndDate: new Date(Date.now() + 86400000 * 35),
          studentMembership: { studentId: 'student-1' },
        },
      });

      prisma.sessionBooking.count.mockResolvedValue(0);

      await expect(service.removeAdjustment('charge-1')).rejects.toThrow(
        /plazo original de reserva \(72h\) del ciclo ya ha expirado/,
      );
    });
  });
});
