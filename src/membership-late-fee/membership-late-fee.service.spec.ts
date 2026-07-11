import { Test, TestingModule } from '@nestjs/testing';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';
import { LateFeeRepository } from './repositories/late-fee.repository';
import { DateUtils } from 'src/utils/date.utils';

describe('MembershipLateFeeService (Motor Nocturno de Moras - Extremo)', () => {
  let service: MembershipLateFeeService;
  let lateFeeRepo: jest.Mocked<LateFeeRepository>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };
    
    const mockLateFeeRepo = {
      findOverdueCharges: jest.fn(),
      findExistingLateFeeCharge: jest.fn(),
      updateLateFeeCharge: jest.fn(),
      createLateFeeCharge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipLateFeeService,
        { provide: LateFeeRepository, useValue: mockLateFeeRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MembershipLateFeeService>(MembershipLateFeeService);
    lateFeeRepo = module.get(LateFeeRepository);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('Reglas de Negocio (Días de Gracia y Habilitación)', () => {
    const baseDate = new Date('2026-08-10T00:00:00.000Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('Caso 1: Ignorar si la temporada NO tiene recargos habilitados (lateFeeEnabled: false)', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
        membershipCharges: [{
          playerMembership: {
            teamSeason: { lateFeeEnabled: false }
          }
        }]
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.findExistingLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.createLateFeeCharge).not.toHaveBeenCalled();
    });

    it('Caso 2: Ignorar si aún está dentro de los días de gracia', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-05T00:00:00.000Z'), // 5 días vencido
        membershipCharges: [{
          playerMembership: {
            teamSeason: { lateFeeEnabled: true, graceDays: 5, lateFeePerDay: 10 }
          }
        }]
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);

      await service.applyDailyLateFees();

      // Al ser 5 <= 5 (días de gracia), no hace nada
      expect(lateFeeRepo.findExistingLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.createLateFeeCharge).not.toHaveBeenCalled();
    });

    it('Caso 3: Crear nuevo recargo si superó gracia (Día 6 con 5 de gracia)', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-04T00:00:00.000Z'), // 6 días vencido respecto a 2026-08-10
        membershipCharges: [{
          playerMembershipId: 'mem-1',
          playerMembership: {
            teamSeason: { lateFeeEnabled: true, graceDays: 5, lateFeePerDay: 10 }
          }
        }]
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      // Días exactos = 6. Penalización = 6 - 5 = 1. Recargo = 1 * 10 = 10.
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentChargeId: 'charge-1',
          amount: 10,
          pendingAmount: 10,
        })
      );
    });
  });

  describe('Actualizaciones Dinámicas (Recálculo Diario de Recargos)', () => {
    const baseDate = new Date('2026-08-10T00:00:00.000Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('Caso 4: Actualizar recargo PENDING existente sumando la diferencia de hoy', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 días vencido
        membershipCharges: [{
          playerMembership: {
            teamSeason: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 5 } // Mora objetivo = 45
          }
        }]
      };

      const existingLateFee = {
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 40, // Ayer era 40 (8 días)
        pendingAmount: 40,
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(existingLateFee as any);

      await service.applyDailyLateFees();

      // Debe actualizar de 40 a 45 (+5)
      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 45,
          pendingAmount: 45,
          status: StatusCharge.PENDING
        })
      );
    });

    it('Caso 5 (Edge Case Extremo): El recargo había sido "PAID" parcialmente y sigue corriendo la mora', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 días vencido. Target mora = 90
        membershipCharges: [{
          playerMembership: {
            teamSeason: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 } 
          }
        }]
      };

      const existingLateFee = {
        id: 'late-1',
        status: StatusCharge.PAID, // Ayer el alumno pagó su mora acumulada (80)
        amount: 80, 
        pendingAmount: 0,
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(existingLateFee as any);

      await service.applyDailyLateFees();

      // Hoy la mora objetivo es 90. 90 - 80 = 10 de diferencia.
      // El estatus debe regresar de PAID a PARTIAL porque vuelve a deber plata.
      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 90,
          pendingAmount: 10,
          status: StatusCharge.PARTIAL // ¡Reapertura por nueva mora!
        })
      );
    });
  });

  describe('Stress Test y Rendimiento Empresarial (Chunking)', () => {
    const baseDate = new Date('2026-08-10T00:00:00.000Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('Caso Extraordinario: Stress Test Cron Diario con 125 deudores masivos', async () => {
      // Simular 125 cargos vencidos
      const massiveOverdueCharges = Array.from({ length: 125 }, (_, i) => ({
        id: `charge-${i}`,
        dueDate: new Date('2026-08-01T00:00:00.000Z'), 
        membershipCharges: [{
          playerMembership: {
            teamSeason: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 }
          }
        }]
      }));

      lateFeeRepo.findOverdueCharges.mockResolvedValue(massiveOverdueCharges as any);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null); // Para que intente crear

      await service.applyDailyLateFees();

      // Verificamos que delegó 125 transacciones individuales.
      // Si el logica de chunks funciona, todas las llamadas suceden (3 iteraciones del for: 50, 50, 25).
      expect(prisma.$transaction).toHaveBeenCalledTimes(125);
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledTimes(125);
    });
  });
});
