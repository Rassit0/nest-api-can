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

    it('Caso 2: Ignorar si aÃºn está dentro de los dÃ­as de gracia', async () => {
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
        await expect(service.previewLateFee('123')).rejects.toThrow(
          'Cargo no encontrado',
        );
      });

      it('Lanza BadRequest si el cargo esta CANCELLED', async () => {
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue({
          id: '123',
          status: StatusCharge.CANCELLED,
          membershipCharges: [
            {
              playerMembership: {
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    graceDays: 2,
                    lateFeePerDay: 10,
                  },
                },
              },
            },
          ],
        } as any);
        await expect(service.previewLateFee('123')).rejects.toThrow('anulado');
      });

      it('Lanza BadRequest si el cargo ya es de tipo LATE_FEE', async () => {
        lateFeeRepo.findChargeForLateFee = jest.fn().mockResolvedValue({
          id: '123',
          status: StatusCharge.PENDING,
          membershipCharges: [
            {
              type: TypeMembershipCharge.LATE_FEE,
              playerMembership: {
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    graceDays: 2,
                    lateFeePerDay: 10,
                  },
                },
              },
            },
          ],
        } as any);
        await expect(service.previewLateFee('123')).rejects.toThrow(
          'recargo por mora',
        );
      });
    });

    describe('applyLateFee', () => {
      it('Falla si customAmount es <= 0', async () => {
        const mockCharge = {
          id: '123',
          status: StatusCharge.PENDING,
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
        };
        lateFeeRepo.findChargeForLateFee = jest
          .fn()
          .mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest
          .fn()
          .mockResolvedValue(null);

        await expect(service.applyLateFee('123', 0)).rejects.toThrow(
          'El monto de mora es 0 o menor.',
        );
      });

      it('Sin customAmount utiliza el calculo automatico', async () => {
        const mockCharge = {
          id: '123',
          status: StatusCharge.PENDING,
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
        };
        lateFeeRepo.findChargeForLateFee = jest
          .fn()
          .mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest
          .fn()
          .mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest
          .fn()
          .mockResolvedValue({ id: 'new-late-fee' } as any);

        await service.applyLateFee('123', undefined);

        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            parentChargeId: '123',
            amount: 90,
            pendingAmount: 90,
          }),
        );
      });

      it('PENDING + customAmount: prioriza el monto manual', async () => {
        const mockCharge = {
          id: '123',
          status: StatusCharge.PENDING,
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
        };
        lateFeeRepo.findChargeForLateFee = jest
          .fn()
          .mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest
          .fn()
          .mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest
          .fn()
          .mockResolvedValue({ id: 'new-late-fee' } as any);

        await service.applyLateFee('123', 100);

        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            parentChargeId: '123',
            amount: 100,
            pendingAmount: 100,
          }),
        );
      });

      it('PAID + customAmount: crea LATE_FEE PENDING correctamente y mantiene intacto el padre', async () => {
        const mockCharge = {
          id: '123',
          status: StatusCharge.PAID,
          amount: 300,
          adjustmentAmount: -50,
          pendingAmount: 0,
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
        };
        lateFeeRepo.findChargeForLateFee = jest
          .fn()
          .mockResolvedValue(mockCharge as any);
        lateFeeRepo.findPendingLateFeeCharge = jest
          .fn()
          .mockResolvedValue(null);
        lateFeeRepo.createLateFeeCharge = jest
          .fn()
          .mockResolvedValue({ id: 'new-late-fee' } as any);

        await service.applyLateFee('123', 75);

        expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            parentChargeId: '123',
            amount: 75,
            pendingAmount: 75,
            status: StatusCharge.PENDING,
            chargeCategory: 'LATE_FEE',
          }),
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
        membershipCharges: [
          {
            type: TypeMembershipCharge.REGISTRATION,
            playerMembershipId: 'mem-1',
            playerMembership: {
              pauses: [],
              teamSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 2,
                  lateFeePerDay: 5,
                },
                teamSeasonPauses: [],
              },
            },
          },
        ],
      };
      lateFeeRepo.findExistingLateFeeCharge = jest.fn().mockResolvedValue(null);
      lateFeeRepo.findPendingLateFeeCharge = jest.fn().mockResolvedValue(null);
      lateFeeRepo.createLateFeeCharge = jest
        .fn()
        .mockResolvedValue({ id: 'new-late-fee' } as any);
      lateFeeRepo.findOverdueCharges = jest
        .fn()
        .mockResolvedValue([mockBaseCharge]);
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
        }),
      );
    });

    it('Caso 2 y 7: Mora manual - Descripción personalizada (customAmount)', async () => {
      lateFeeRepo.findChargeForLateFee.mockResolvedValue(mockBaseCharge);
      await service.applyLateFee('charge-1', 100);
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description:
            'Mora sobre: Cuota Mes - Julio 2026 (Monto personalizado)',
        }),
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
        }),
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
        }),
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
        }),
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
        }),
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
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(
        existingLateFee as any,
      );
      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          description: 'Mora sobre: Cuota Mes - Julio 2026 (8 x 5/día)',
        }),
      );
      jest.useRealTimers();
    });
  });

  describe('Timezone Late Fee Regression Test (+1 day bug)', () => {
    it('should correctly calculate 48 days of penalty when dueDate is exactly 02/08/2026 03:59:59.999Z', async () => {
      // Evaluation date exactly on Sept 28, 2026 13:13:20 (local), 17:13:20 UTC
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-09-28T17:13:20.408Z'));

      const mockedCharges = [
        {
          id: 'charge-1',
          amount: 100,
          pendingAmount: 100,
          status: 'PENDING',
          // Exactly the expected output of DateUtils.getEndOfLocalDayFromParts(2026, 7, 1)
          dueDate: new Date('2026-08-02T03:59:59.999Z'),
          membershipCharges: [
            {
              playerMembership: {
                id: 'membership-1',
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    graceDays: 10, // 10 grace days
                    lateFeePercent: null,
                    lateFeePerDay: 1, // 1 Bs per day
                  },
                },
              },
            },
          ],
        },
      ];
      lateFeeRepo.findOverdueCharges.mockResolvedValue(mockedCharges as any);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      // Run
      await service.applyDailyLateFees();

      // Expectations
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // The math:
          // Local eval day in UTC: 2026-09-29T03:59:59.999Z
          // Diff: 2026-09-29T03:59:59.999Z - 2026-08-02T03:59:59.999Z = 58 days exact
          // Grace days: 10
          // Penalty days: 48
          // lateFeePerDay: 1
          // Total: 48 Bs
          amount: 48,
          pendingAmount: 48,
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('Recálculo Bidireccional de Mora (Charge.dueDate source-of-truth)', () => {
    const baseDate = new Date('2026-09-28T12:00:00.000Z');

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    const getMockCharge = (dueDateStr: string) => ({
      id: 'charge-bidi',
      dueDate: new Date(dueDateStr),
      description: 'Test Charge',
      membershipCharges: [
        {
          playerMembership: {
            teamSeason: {
              billingConfig: {
                lateFeeEnabled: true,
                graceDays: 0,
                lateFeePerDay: 1,
              },
            },
          },
        },
      ],
    });

    it('TEST A — CREATE NORMAL', async () => {
      const charge = getMockCharge('2026-09-18T00:00:00.000Z'); // 11 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 11,
          pendingAmount: 11,
          status: StatusCharge.PENDING,
        }),
      );
    });

    it('TEST B — EXISTING PENDING UNPAID — INCREASE', async () => {
      const charge = getMockCharge('2026-09-13T00:00:00.000Z'); // 16 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 10,
        pendingAmount: 10,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 16,
          pendingAmount: 16,
        }),
      );
    });

    it('TEST C — EXISTING PENDING UNPAID — DECREASE', async () => {
      const charge = getMockCharge('2026-09-16T00:00:00.000Z'); // 13 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 18,
        pendingAmount: 18,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 13,
          pendingAmount: 13,
        }),
      );
    });

    it('TEST D — SAME AMOUNT (Idempotency)', async () => {
      const charge = getMockCharge('2026-09-10T00:00:00.000Z'); // 19 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 19,
        pendingAmount: 19,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.createLateFeeCharge).not.toHaveBeenCalled();
    });

    it('TEST CON dueDate REAL — HACIA ATRÁS (Increase)', async () => {
      // dueDate A: Sept 20 -> 9 days late = 9 fee
      const charge = getMockCharge('2026-09-20T00:00:00.000Z');
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 9,
        pendingAmount: 9,
      } as any);

      // Mover dueDate hacia atrás a Sept 10 -> 19 days late
      charge.dueDate = new Date('2026-09-10T00:00:00.000Z');
      
      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 19,
          pendingAmount: 19,
        }),
      );
    });

    it('TEST CON dueDate REAL — HACIA ADELANTE (Decrease)', async () => {
      // dueDate A: Sept 10 -> 19 days late = 19 fee
      const charge = getMockCharge('2026-09-10T00:00:00.000Z');
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 19,
        pendingAmount: 19,
      } as any);

      // Mover dueDate hacia adelante a Sept 20 -> 9 days late
      charge.dueDate = new Date('2026-09-20T00:00:00.000Z');
      
      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({
          amount: 9,
          pendingAmount: 9,
        }),
      );
    });

    it('TEST DE SOURCE OF TRUTH (Charge.dueDate is what matters)', async () => {
      const charge = getMockCharge('2026-09-10T00:00:00.000Z'); // 19 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ amount: 19 })
      );

      jest.clearAllMocks();

      // Modify ONLY dueDate
      charge.dueDate = new Date('2026-09-20T00:00:00.000Z'); // 9 days late
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 19,
        pendingAmount: 19,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        'late-1',
        expect.objectContaining({ amount: 9, pendingAmount: 9 })
      );
    });

    describe('VERIFICACIÓN MATEMÁTICA DEFINITIVA (graceDays=10)', () => {
      it('CONTROL CASE: 28/09/2026 -> 17 días de mora', () => {
        // dueDate: 01/09/2026 23:59:59.999 La Paz
        const dueDate = new Date('2026-09-02T03:59:59.999Z');
        // evalDate: 28/09/2026 23:59:59.999 La Paz
        const evalDate = new Date('2026-09-29T03:59:59.999Z');

        const mockCharge = {
          id: 'charge-math',
          dueDate,
          membershipCharges: [
            {
              playerMembership: {
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    isEngineActive: true,
                    graceDays: 10,
                    lateFeePerDay: 1,
                  },
                },
              },
            },
          ],
        };

        const result = service.calculateLateFeePure(
          mockCharge.id,
          mockCharge.dueDate,
          mockCharge.membershipCharges[0].playerMembership.teamSeason,
          mockCharge.membershipCharges[0].playerMembership,
          evalDate,
        );

        expect(result.elapsedDays).toBe(27);
        expect(result.penaltyDays).toBe(17);
        expect(result.totalLateFeeAmount).toBe(17);
      });

      it('TEST DE BORDE — ÚLTIMO DÍA DE GRACIA (11/09/2026)', () => {
        const dueDate = new Date('2026-09-02T03:59:59.999Z');
        const evalDate = new Date('2026-09-12T03:59:59.999Z'); // 11/09/2026 23:59:59.999 La Paz

        const mockCharge = {
          id: 'charge-border-1',
          dueDate,
          membershipCharges: [
            {
              playerMembership: {
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    isEngineActive: true,
                    graceDays: 10,
                    lateFeePerDay: 1,
                  },
                },
              },
            },
          ],
        };

        const result = service.calculateLateFeePure(
          mockCharge.id,
          mockCharge.dueDate,
          mockCharge.membershipCharges[0].playerMembership.teamSeason,
          mockCharge.membershipCharges[0].playerMembership,
          evalDate,
        );

        expect(result.elapsedDays).toBe(10);
        expect(result.penaltyDays).toBe(0);
        expect(result.totalLateFeeAmount).toBe(0);
      });

      it('TEST DE BORDE — PRIMER DÍA DE MORA (12/09/2026)', () => {
        const dueDate = new Date('2026-09-02T03:59:59.999Z');
        const evalDate = new Date('2026-09-13T03:59:59.999Z'); // 12/09/2026 23:59:59.999 La Paz

        const mockCharge = {
          id: 'charge-border-2',
          dueDate,
          membershipCharges: [
            {
              playerMembership: {
                teamSeason: {
                  billingConfig: {
                    lateFeeEnabled: true,
                    isEngineActive: true,
                    graceDays: 10,
                    lateFeePerDay: 1,
                  },
                },
              },
            },
          ],
        };

        const result = service.calculateLateFeePure(
          mockCharge.id,
          mockCharge.dueDate,
          mockCharge.membershipCharges[0].playerMembership.teamSeason,
          mockCharge.membershipCharges[0].playerMembership,
          evalDate,
        );

        expect(result.elapsedDays).toBe(11);
        expect(result.penaltyDays).toBe(1);
        expect(result.totalLateFeeAmount).toBe(1);
      });
    });

    it('PARTIAL — REGRESSION TEST (No disminuir destructivamente)', async () => {
      const charge = getMockCharge('2026-09-16T00:00:00.000Z'); // 12 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PARTIAL,
        amount: 18,
        pendingAmount: 8, // paid 10
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).not.toHaveBeenCalled();
    });

    it('PAID — REGRESSION TEST (No disminuir automáticamente)', async () => {
      const charge = getMockCharge('2026-09-16T00:00:00.000Z'); // 12 days late
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PAID,
        amount: 18,
        pendingAmount: 0,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).not.toHaveBeenCalled();
    });

    it('ZERO CASE TEST (Comportamiento actual para cálculo = 0)', async () => {
      const charge = getMockCharge('2026-09-29T00:00:00.000Z'); // Not late yet (evaluation is 28th)
      lateFeeRepo.findOverdueCharges.mockResolvedValue([charge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue({
        id: 'late-1',
        status: StatusCharge.PENDING,
        amount: 10,
        pendingAmount: 10,
      } as any);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.updateLateFeeCharge).not.toHaveBeenCalled();
      expect(lateFeeRepo.findExistingLateFeeCharge).not.toHaveBeenCalled();
    });
  });
});
