import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import {
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentLateFeeRepository } from './repositories/student-late-fee.repository';

describe('StudentLateFeeService - Pruebas Extremas', () => {
  let service: StudentLateFeeService;
  let lateFeeRepo: jest.Mocked<StudentLateFeeRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockLateFeeRepo = {
      findOverdueCharges: jest.fn(),
      findExistingLateFeeCharge: jest.fn(),
      updateLateFeeCharge: jest.fn(),
      createLateFeeCharge: jest.fn(),
    };

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentLateFeeService,
        {
          provide: StudentLateFeeRepository,
          useValue: mockLateFeeRepo,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<StudentLateFeeService>(StudentLateFeeService);
    lateFeeRepo = module.get(StudentLateFeeRepository);
    prisma = module.get(PrismaService);
  });

  describe('Lógica de Pausas Extremas (Merged Intervals)', () => {
    const baseDate = new Date('2026-08-10T00:00:00.000Z'); // Hoy es 10 de Agosto

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(baseDate);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it('Caso A: Pausa global y pausa individual superpuestas no deben duplicar la resta', async () => {
      const mockCharge = {
        id: 'charge-student-1',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // Vencido hace 9 días (del 1 al 10)
        studentCharges: [
          {
            studentMembershipId: 'stu-1',
            studentMembership: {
              pauses: [
                {
                  // Pausa del estudiante del 3 al 6 (4 días)
                  startDate: new Date('2026-08-03T00:00:00.000Z'),
                  endDate: new Date('2026-08-06T00:00:00.000Z'),
                },
              ],
              courseSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 10,
                },
                pauses: [
                  {
                    // Pausa global del curso del 5 al 8 (4 días)
                    startDate: new Date('2026-08-05T00:00:00.000Z'),
                    endDate: new Date('2026-08-08T00:00:00.000Z'),
                  },
                ],
              },
            },
          },
        ],
      };

      // Explicación de pausas:
      // Ind: 3, 4, 5, 6
      // Glo:       5, 6, 7, 8
      // Merged: 3, 4, 5, 6, 7, 8 -> ¡6 días en total pausados!
      // Días transcurridos = 9. Días pausados = 6. Días mora = 3.
      // Target mora = 3 * 10 = 30.

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentChargeId: 'charge-student-1',
          amount: 30, // 3 días a 10 = 30
          pendingAmount: 30,
        }),
      );
    });

    it('Caso B: Pausas fuera de rango (antes del vencimiento o después de hoy)', async () => {
      const mockCharge = {
        id: 'charge-student-2',
        dueDate: new Date('2026-08-05T00:00:00.000Z'), // 5 días transcurridos (5 al 10)
        studentCharges: [
          {
            studentMembershipId: 'stu-2',
            studentMembership: {
              pauses: [],
              courseSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 10,
                },
                pauses: [
                  {
                    // Pausa ocurre ANTES del vencimiento (no afecta la mora)
                    startDate: new Date('2026-07-20T00:00:00.000Z'),
                    endDate: new Date('2026-07-25T00:00:00.000Z'),
                  },
                  {
                    // Pausa ocurre DESPUÉS de la fecha actual de evaluación (no afecta la mora calculada HOY)
                    startDate: new Date('2026-08-15T00:00:00.000Z'),
                    endDate: new Date('2026-08-20T00:00:00.000Z'),
                  },
                ],
              },
            },
          },
        ],
      };

      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      // Ninguna pausa aplica. Días mora = 5. Target mora = 5 * 10 = 50.
      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 50,
        }),
      );
    });

    it('Caso C: Múltiples pausas fragmentadas correctamente unidas', async () => {
      const mockCharge = {
        id: 'charge-student-3',
        dueDate: new Date('2026-08-01T00:00:00.000Z'), // 9 días vencido
        studentCharges: [
          {
            studentMembershipId: 'stu-3',
            studentMembership: {
              pauses: [
                {
                  startDate: new Date('2026-08-02T00:00:00.000Z'),
                  endDate: new Date('2026-08-03T00:00:00.000Z'), // 2 días (2, 3)
                },
                {
                  startDate: new Date('2026-08-07T00:00:00.000Z'),
                  endDate: new Date('2026-08-08T00:00:00.000Z'), // 2 días (7, 8)
                },
              ],
              courseSeason: {
                billingConfig: {
                  lateFeeEnabled: true,
                  graceDays: 0,
                  lateFeePerDay: 5,
                },
                pauses: [],
              },
            },
          },
        ],
      };

      // Transcurridos = 9. Pausas = 4 días. Mora = 5 días. 5 * 5 = 25.
      lateFeeRepo.findOverdueCharges.mockResolvedValue([mockCharge as any]);
      lateFeeRepo.findExistingLateFeeCharge.mockResolvedValue(null);

      await service.applyDailyLateFees();

      expect(lateFeeRepo.createLateFeeCharge).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 25,
        }),
      );
    });
  });
});
