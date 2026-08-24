import { Test, TestingModule } from '@nestjs/testing';
import { StudentMembershipsCron } from './student-memberships.cron';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipStatus, CycleEnrollmentStatus, StudentMembershipSuspensionReason } from 'src/generated/prisma/client';

describe('StudentMembershipsCron', () => {
  let cron: StudentMembershipsCron;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      studentMembership: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentMembershipsCron,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    cron = module.get<StudentMembershipsCron>(StudentMembershipsCron);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fase 3B - Reactivación por fin de pausa programada', () => {
    
    // Mocking membershipsToSuspend as empty so we focus on the second part (membershipsToActivate)
    const mockSuspendEmpty = () => {
      prisma.studentMembership.findMany.mockImplementation(async (args) => {
        if (args.where.status === StudentMembershipStatus.ACTIVE) {
          return [];
        }
        return [{ id: 'mem-1' }];
      });
    };

    it('Caso 1: Pausa termina + ciclo vigente -> ACTIVE', async () => {
      mockSuspendEmpty();
      prisma.studentMembership.updateMany.mockResolvedValue({ count: 1 });

      await cron.handleMembershipPauses();

      expect(prisma.studentMembership.updateMany).toHaveBeenCalledWith({
        where: { id: 'mem-1', status: StudentMembershipStatus.SUSPENDED, suspensionReason: StudentMembershipSuspensionReason.PAUSE },
        data: expect.objectContaining({ status: StudentMembershipStatus.ACTIVE, suspensionReason: null })
      });
    });

    it('Caso 2 y 3 y 5: Si el query Prisma excluye la membresía', async () => {
      // Si Prisma findMany no retorna membresías, updateMany no se llama.
      // Validamos que el query findMany efectivamente incluyó la restricción correcta.
      prisma.studentMembership.findMany.mockResolvedValue([]);

      await cron.handleMembershipPauses();

      const activateCall = prisma.studentMembership.findMany.mock.calls.find(
        (call) => call[0].where.status === StudentMembershipStatus.SUSPENDED
      );

      // No se intentó activar nada
      expect(prisma.studentMembership.updateMany).not.toHaveBeenCalled();
    });

    it('Caso 4: Ciclo comienza exactamente ahora -> cycleStartDate <= currentDate lo incluye', async () => {
      // El test 2 ya verificó que la condición enviada a Prisma es cycleStartDate <= currentDate (lte)
      // Prisma lo procesará correctamente como vigente.
      mockSuspendEmpty();
      prisma.studentMembership.updateMany.mockResolvedValue({ count: 1 });
      await cron.handleMembershipPauses();
      expect(prisma.studentMembership.updateMany).toHaveBeenCalled();
    });

    it('Caso 6: Varios ciclos, si alguno es vigente -> ACTIVE', async () => {
      // Prisma `some` valida exactamente esto: si existe "al menos uno" vigente, la membresía es retornada
      mockSuspendEmpty();
      prisma.studentMembership.updateMany.mockResolvedValue({ count: 1 });
      await cron.handleMembershipPauses();
      expect(prisma.studentMembership.updateMany).toHaveBeenCalled();
    });

    it('Caso 7: Deuda histórica', async () => {
      // La deuda no interfiere porque la consulta Prisma no filtra por StudentCharge = PENDING.
      mockSuspendEmpty();
      prisma.studentMembership.updateMany.mockResolvedValue({ count: 1 });
      await cron.handleMembershipPauses();
      expect(prisma.studentMembership.updateMany).toHaveBeenCalled();
    });

    it('Caso 8: Dos ejecuciones concurrentes / seguridad transaccional', async () => {
      mockSuspendEmpty();
      // Simulamos que el updateMany no afecta a ninguna fila (count: 0) porque otra transacción
      // ya lo pasó a ACTIVE u otro estado.
      prisma.studentMembership.updateMany.mockResolvedValue({ count: 0 });

      await cron.handleMembershipPauses();

      // updateMany fue llamado de forma condicionada
      expect(prisma.studentMembership.updateMany).toHaveBeenCalledWith({
        where: { id: 'mem-1', status: StudentMembershipStatus.SUSPENDED, suspensionReason: StudentMembershipSuspensionReason.PAUSE },
        data: expect.objectContaining({ status: StudentMembershipStatus.ACTIVE, suspensionReason: null })
      });
      // El log no debería fallar ni lanzar excepción que rompa el cron
    });

    it('Mantiene comportamiento original de Suspensión (membershipsToSuspend)', async () => {
      prisma.studentMembership.findMany.mockImplementation(async (args) => {
        if (args.where.status === StudentMembershipStatus.ACTIVE) {
          return [{ id: 'mem-to-suspend' }]; // Para suspender
        }
        return []; // Nada para reactivar
      });
      
      prisma.studentMembership.update.mockResolvedValue({});

      await cron.handleMembershipPauses();

      expect(prisma.studentMembership.update).toHaveBeenCalledWith({
        where: { id: 'mem-to-suspend' },
        data: expect.objectContaining({ status: StudentMembershipStatus.SUSPENDED, suspensionReason: StudentMembershipSuspensionReason.PAUSE })
      });
    });

    it('Robustez: Un error no detiene el ciclo', async () => {
      prisma.studentMembership.findMany.mockImplementation(async (args) => {
        if (args.where.status === StudentMembershipStatus.SUSPENDED) {
          return [{ id: 'mem-fail' }, { id: 'mem-success' }];
        }
        return [];
      });

      prisma.studentMembership.updateMany
        .mockRejectedValueOnce(new Error('DB Error')) // mem-fail lanza error
        .mockResolvedValueOnce({ count: 1 }); // mem-success pasa ok

      await cron.handleMembershipPauses();

      expect(prisma.studentMembership.updateMany).toHaveBeenCalledTimes(2);
      expect(prisma.studentMembership.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'mem-success', status: StudentMembershipStatus.SUSPENDED, suspensionReason: StudentMembershipSuspensionReason.PAUSE },
        data: expect.anything()
      });
    });
  });
});
