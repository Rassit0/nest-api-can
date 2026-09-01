import { Test, TestingModule } from '@nestjs/testing';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { PrismaService } from 'src/prisma.service';
import {
  StatusCharge,
  TypeMembershipCharge,
  Charge,
} from 'src/generated/prisma/client';
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

  describe('Reglas de Negocio (DÃ­as de Gracia y HabilitaciÃ³n)', () => {
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
        membershipCharges: [
          {
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: false,
                },
              },
            },
          },
        ],
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.findExistingLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.createLateFeeCharge).not.toHaveBeenCalled();
    });

    it('Caso 2: Ignorar si aÃºn estÃ¡ dentro de los dÃ­as de gracia', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-05T00:00:00.000Z'), // 5 dÃ­as vencido
        membershipCharges: [
          {
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 5,
                  lateFeePerDay: 10,
                },
              },
            },
          },
        ],
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);

      await service.applyDailyLateFees();

      // Al ser 5 <= 5 (dÃ­as de gracia), no hace nada
      expect(lateFeeRepo.findExistingLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.createLateFeeCharge).not.toHaveBeenCalled();
    });

    it('Caso 3: Crear nuevo recargo si superÃ³ gracia (DÃ­a 6 con 5 de gracia)', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-04T00:00:00.000Z'), // 6 dÃ­as vencido respecto a 2026-08-10
        membershipCharges: [
          {
            playerMembershipId: 'mem-1',
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 5,
                  lateFeePerDay: 10,
                },
              },
            },
          },
        ],
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      // DÃ­as exactos = 6. PenalizaciÃ³n = 6 - 5 = 1. Recargo = 1 * 10 = 10.
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentChargeId: 'charge-1',
          amount: 10,
          pendingAmount: 10,
        }),
      );
    });
    it('Caso Pausas: SuperposiciÃ³n de pausa individual y global (Merged Intervals)', async () => {
      const mockCharge = {
        id: 'charge-pause',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 dÃ­as vencido (del 1 al 10)
        membershipCharges: [
          {
            playerMembershipId: 'mem-1',
            playerMembership: {
              pauses: [
                {
                  startDate: new Date('2026-08-02T00:00:00.000Z'),
                  endDate: new Date('2026-08-06T00:00:00.000Z'), // 5 dÃ­as individuales
                },
              ],
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 10,
                },
                teamSeasonPauses: [
                  {
                    startDate: new Date('2026-08-05T00:00:00.000Z'),
                    endDate: new Date('2026-08-07T00:00:00.000Z'), // 3 dÃ­as globales
                  },
                ],
              },
            },
          },
        ],
      };

      // ExplicaciÃ³n de pausas:
      // Ind: 2, 3, 4, 5, 6
      // Glo:          5, 6, 7
      // Merged: 2, 3, 4, 5, 6, 7 (6 dÃ­as inactivos totales)
      // DÃ­as transcurridos = 9. DÃ­as activos = 3. Target mora = 30.

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 30, // 3 * 10
        }),
      );
    });
  });

  describe('Actualizaciones DinÃ¡micas (RecÃ¡lculo Diario de Recargos)', () => {
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
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 dÃ­as vencido
        membershipCharges: [
          {
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 5,
                },
              }, // Mora objetivo = 45
            },
          },
        ],
      };

      const existingLateFee = {
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 40, // Ayer era 40 (8 dÃ­as)
        pendingAmount: 40,
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(
        existingLateFee as any,
      );

      await service.applyDailyLateFees();

      // Debe actualizar de 40 a 45 (+5)
      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 45,
          pendingAmount: 45,
          status: StatusCharge.PENDING,
        }),
      );
    });

    it('Caso 5 (Edge Case Extremo): El recargo habÃ­a sido "PAID" parcialmente y sigue corriendo la mora', async () => {
      const mockCharge = {
        id: 'charge-1',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 dÃ­as vencido. Target mora = 90
        membershipCharges: [
          {
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 10,
                },
              },
            },
          },
        ],
      };

      const existingLateFee = {
        id: 'late-1',
        status: StatusCharge.PAID, // Ayer el alumno pagÃ³ su mora acumulada (80)
        amount: 80,
        pendingAmount: 0,
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(
        existingLateFee as any,
      );

      await service.applyDailyLateFees();

      // Hoy la mora objetivo es 90. 90 - 80 = 10 de diferencia.
      // El estatus debe regresar de PAID a PARTIAL porque vuelve a deber plata.
      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 90,
          pendingAmount: 10,
          status: StatusCharge.PARTIAL, // Â¡Reapertura por nueva mora!
        }),
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
        membershipCharges: [
          {
            playerMembership: {
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 10,
                },
              },
            },
          },
        ],
      }));

      lateFeeRepo.findOverdueCharges.mockResolvedValue(
        massiveOverdueCharges as any,
      );
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null); // Para que intente crear

      await service.applyDailyLateFees();

      // Verificamos que delegÃ³ 125 transacciones individuales.
      // Si el logica de chunks funciona, todas las llamadas suceden (3 iteraciones del for: 50, 50, 25).
      expect(prisma.$transaction).toHaveBeenCalledTimes(125);
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledTimes(125);
    });
  });
  describe('MembershipLateFeeService - On Demand (Manual & Historical)', () => {
    const baseDate = new Date('2026-08-10T00:00:00.000Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    describe('previewLateFee', () => {
      it('Lanza NotFound si el cargo no existe', async () => {
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue(null);
        await expect(service.previewLateFee('123')).rejects.toThrow('Cargo no encontrado');
      });

      it('Lanza BadRequest si el cargo esta CANCELLED', async () => {
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue({
          id: '123', status: StatusCharge.CANCELLED,
          membershipCharges: [{ playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 } } } }],
        } as any);
        await expect(service.previewLateFee('123')).rejects.toThrow('anulado');
      });

      it('Lanza BadRequest si el cargo ya es de tipo LATE_FEE', async () => {
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue({
          id: '123', status: StatusCharge.PENDING,
          membershipCharges: [{ type: TypeMembershipCharge.LATE_FEE, playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 10 } } } }],
        } as any);
        await expect(service.previewLateFee('123')).rejects.toThrow('recargo por mora');
      });
    });

    describe('applyLateFee', () => {
      it('Falla si customAmount es <= 0', async () => {
        const mockCharge = {
          id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'), 
          membershipCharges: [{ playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 } } } }],
        };
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
        
        await expect(service.applyLateFee('123', 0)).rejects.toThrow('El monto de mora es 0 o menor.');
      });

      it('Sin customAmount utiliza el calculo automatico', async () => {
        const mockCharge = {
          id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'),
          membershipCharges: [{ playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 } } } }],
        };
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest.fn().mockResolvedValue({ id: 'new-late-fee' } as any);
        
        await service.applyLateFee('123', undefined);
        
        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ parentChargeId: '123', amount: 90, pendingAmount: 90 })
        );
      });

      it('PENDING + customAmount: prioriza el monto manual', async () => {
        const mockCharge = {
          id: '123', status: StatusCharge.PENDING, dueDate: new Date('2026-08-01T00:00:00.000Z'),
          membershipCharges: [{ playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 } } } }],
        };
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest.fn().mockResolvedValue({ id: 'new-late-fee' } as any);
        
        await service.applyLateFee('123', 100); 
        
        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ parentChargeId: '123', amount: 100, pendingAmount: 100 })
        );
      });

      it('PAID + customAmount: crea LATE_FEE PENDING correctamente y mantiene intacto el padre', async () => {
        const mockCharge = {
          id: '123', status: StatusCharge.PAID, amount: 300, adjustmentAmount: -50, pendingAmount: 0, dueDate: new Date('2026-08-01T00:00:00.000Z'),
          membershipCharges: [{ playerMembership: { teamSeason: { billingConfig: { lateFeeEnabled: true, graceDays: 0, lateFeePerDay: 10 } } } }],
        };
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest.fn().mockResolvedValue({ id: 'new-late-fee' } as any);
        
        await service.applyLateFee('123', 75); 
        
        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            parentChargeId: '123', amount: 75, pendingAmount: 75,
            status: StatusCharge.PENDING, chargeCategory: 'LATE_FEE'
          })
        );

        expect(mockCharge.status).toBe(StatusCharge.PAID);
        expect(mockCharge.pendingAmount).toBe(0);
        expect(mockCharge.amount).toBe(300);
        expect(mockCharge.adjustmentAmount).toBe(-50);
      });
    });
  });

  describe('Generación de Descripción Contextual', () => {
    let mockBaseCharge: any;

    beforeEach(() => {
      mockBaseCharge = {
        id: 'charge-1',
        description: 'Cuota Mes - Julio 2026',
        status: StatusCharge.PENDING,
        dueDate: new Date('2026-08-01T00:00:00.000Z'),
        membershipCharges: [{ 
          type: TypeMembershipCharge.REGISTRATION, 
          playerMembershipId: 'mem-1',
          playerMembership: { 
            pauses: [], 
            teamSeason: { 
              billingConfig: { lateFeeEnabled: true, graceDays: 2, lateFeePerDay: 5 }, 
              teamSeasonPauses: [] 
            } 
          } 
        }],
      };
      lateFeeRepo.findExistingLateFeeCharge = jest.fn().mockResolvedValue(null);
      lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge = jest.fn().mockResolvedValue({ id: 'new-late-fee' } as any);
      lateFeeRepo.findOverdueCharges = jest.fn().mockResolvedValue([mockBaseCharge]);
      lateFeeRepo.findChargeForLateFee = jest.fn();
      lateFeeRepo.updateLateFeeCharge = jest.fn();
    });

    it('Caso 1 y 7: Mora manual - Descripción normal', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026',
        })
      );
    });

    it('Caso 2 y 7: Mora manual - Descripción personalizada (customAmount)', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1', 100);
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026 (Monto personalizado)',
        })
      );
    });

    it('Caso 3: Descripción NULL', async () => {
      mockBaseCharge.description = null;
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });

    it('Caso 4: Descripción vacía', async () => {
      mockBaseCharge.description = '';
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });

    it('Caso 5: Descripción con espacios', async () => {
      mockBaseCharge.description = '   ';
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1');
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cargo original',
        })
      );
    });

    it('Caso 6: Mora automática - Creación', async () => {
      // Mock para simular 10 días vencidos (1 de Agosto vencimiento, 11 de Agosto eval)
      jest.useFakeTimers().setSystemTime(new Date('2026-08-11T00:00:00.000Z'));
      await service.applyDailyLateFees();
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026 (8 días de retraso)',
        })
      );
      jest.useRealTimers();
    });

    it('Caso 6: Mora automática - Actualización', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-11T00:00:00.000Z'));
      const existingLateFee = {
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 30,
        pendingAmount: 30,
      };
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(existingLateFee as any);
      await service.applyDailyLateFees();
      
      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026 (8 x 5/día)',
        })
      );
      jest.useRealTimers();
    });
  });
});
