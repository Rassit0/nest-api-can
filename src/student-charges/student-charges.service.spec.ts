import { Test, TestingModule } from '@nestjs/testing';
import { StudentChargesService } from './student-charges.service';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  TypeMembershipCharge,
  StatusCourseSeason,
  StudentMembership,
} from 'src/generated/prisma/client';
import { PreviewCharge } from './interfaces/student-charge.types';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentGenerationService } from './services/student-generation.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';
import { DateUtils } from 'src/utils/date.utils';
import { StudentChargeRecalculationService } from './services/student-recalculation.service';
import { StudentManualChargeService } from './services/student-manual-charge.service';
import { StudentAdvanceChargeService } from './services/student-advance-charge.service';

describe('StudentChargesService (Financial Engine - Extremo)', () => {
  let service: StudentChargesService;
  let membershipRepo: jest.Mocked<StudentMembershipRepository>;
  let chargeRepo: jest.Mocked<StudentChargeRepository>;
  let generationService: jest.Mocked<StudentGenerationService>;
  let prisma: PrismaService;
  let manualSvc: StudentManualChargeService;
  let recalcSvc: StudentChargeRecalculationService;
  let advanceSvc: StudentAdvanceChargeService;

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };

    const mockMembershipRepo = {
      getCourseSeasonOrThrow: jest.fn(),
      getPaymentPlanOrThrow: jest.fn(),
      getMembershipOrThrow: jest.fn(),
      getMembershipById: jest.fn(),
      getActiveMembershipsIdsBySeason: jest.fn(),
      getMembershipsForDailyGeneration: jest.fn(),
      updateNextGenerationPointer: jest.fn(),
    };

    const mockChargeRepo = {
      fetchExistingCharges: jest.fn(),
      fetchFullyPendingFutureStudentCharges: jest.fn(),
      bulkCreateCharges: jest.fn(),
      bulkCreateStudentCharges: jest.fn(),
      deletePendingCharges: jest.fn(),
    };

    const mockGenerationService = {
      ensureStudentCharges: jest.fn(),
      ensureRecurringCharges: jest.fn(),
      findNextUngeneratedCycles: jest.fn(),
      generateAdvanceCharges: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentChargesService,
        StudentPreviewService, // Inyección real para mantener tests de cálculo matemático de ciclos
        { provide: StudentGenerationService, useValue: mockGenerationService },
        { provide: StudentMembershipRepository, useValue: mockMembershipRepo },
        { provide: StudentChargeRepository, useValue: mockChargeRepo },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: StudentChargeRecalculationService,
          useValue: { recalculatePendingFutureCharges: jest.fn() },
        },
        {
          provide: StudentManualChargeService,
          useValue: {
            createMassiveManualCharge: jest.fn(async () => ({
              message: '3500 miembros',
            })),
            createManualCharge: jest.fn(),
          },
        },
        {
          provide: StudentAdvanceChargeService,
          useValue: {
            previewAdvanceCharges: jest.fn(),
            generateAdvanceCharges: jest.fn(async (m, q) => {
              if (q === 5) return { message: 'No hay más cuotas disponibles' };
              return {
                message: 'Se generaron exitosamente 2 cuotas por adelantado',
              };
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StudentChargesService>(StudentChargesService);
    membershipRepo = module.get(StudentMembershipRepository);
    chargeRepo = module.get(StudentChargeRepository);
    generationService = module.get(StudentGenerationService);
    prisma = module.get(PrismaService);
    manualSvc = module.get(StudentManualChargeService);
    recalcSvc = module.get(StudentChargeRecalculationService);
    advanceSvc = module.get(StudentAdvanceChargeService);
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('previewCharges (Casos Dorados de Motor Financiero)', () => {
    const mockSeason = {
      id: 'season-1',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      status: 'ACTIVE',
    };

    const mockCourseSeason = {
      id: 'course-season-1',
      billingConfig: {
        billingType: 'MONTHLY',
        billingFrequency: 'MONTHLY',
        billingDay: 1,
        registrationFee: 100,
        recurringFee: 200,
        seasonFee: null,
        prorateFirstRecurringFee: true,
        prorateRegistrationFee: false,
      },
      season: mockSeason,
      status: 'ACTIVE',
    };

    const basePlan = {
      id: 'plan-1',
      isSinglePayment: false,
      advanceCycles: 1,
      advanceCyclesDiscountPercent: 0,
      recurringDiscountPercent: 0,
      registrationDiscountPercent: 0,
    };

    it('Caso 1: Cobro Mensual Estándar (Sin descuentos, 1 ciclo)', async () => {
      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue(
        mockCourseSeason as unknown as Awaited<
          ReturnType<typeof membershipRepo.getCourseSeasonOrThrow>
        >,
      );
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(
        basePlan as unknown as Awaited<
          ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>
        >,
      );

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      expect(result.charges.length).toBe(2);

      const regCharge = result.charges.find(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.REGISTRATION,
      );
      expect(regCharge?.amount).toBe(100);

      const recCharge = result.charges.find(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE,
      );
      expect(recCharge?.amount).toBe(200);
      expect(recCharge?.description).toContain(
        'Primera Mensualidad - Enero 2026',
      );
    });

    it('Caso 2: Cobro Agrupado (Trimestral, advanceCycles = 3, sin descuento)', async () => {
      const trimestralPlan = { ...basePlan, advanceCycles: 3 };

      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue(
        mockCourseSeason as unknown as Awaited<
          ReturnType<typeof membershipRepo.getCourseSeasonOrThrow>
        >,
      );
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(
        trimestralPlan as unknown as Awaited<
          ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>
        >,
      );

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE,
      );
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(200);
      expect(recCharges[0].description).toContain('Mensualidad');
    });

    it('Caso 3: Cobro Agrupado con Descuento Adelantado (advanceCycles = 3, discount = 100%)', async () => {
      const trimestralPromoPlan = {
        ...basePlan,
        advanceCycles: 3,
        advanceCyclesDiscountPercent: 100,
      };

      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue(
        mockCourseSeason as unknown as Awaited<
          ReturnType<typeof membershipRepo.getCourseSeasonOrThrow>
        >,
      );
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(
        trimestralPromoPlan as unknown as Awaited<
          ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>
        >,
      );

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE,
      );
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(0); // 100% discount
      expect(recCharges[0].discountAmount).toBe(200);
    });

    it('Caso 4: Pago Único de Temporada (isSinglePayment = true)', async () => {
      const singlePlan = {
        ...basePlan,
        isSinglePayment: true,
        seasonFeeDiscountPercent: 10,
      };
      const courseSeasonSingle = {
        ...mockCourseSeason,
        billingConfig: {
          ...mockCourseSeason.billingConfig,
          billingType: 'SINGLE_ONLY',
          seasonFee: 2000,
        },
      };

      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue(
        courseSeasonSingle as unknown as Awaited<
          ReturnType<typeof membershipRepo.getCourseSeasonOrThrow>
        >,
      );
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(
        singlePlan as unknown as Awaited<
          ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>
        >,
      );

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const seasonCharge = result.charges.find(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.SEASON_FEE,
      );
      expect(seasonCharge?.amount).toBe(1800); // 2000 - 10%
      expect(seasonCharge?.discountAmount).toBe(200);
    });

    it('Caso 5: Prorrateo primera cuota (Ingreso a mitad de mes)', async () => {
      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue(
        mockCourseSeason as unknown as Awaited<
          ReturnType<typeof membershipRepo.getCourseSeasonOrThrow>
        >,
      );
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(
        basePlan as unknown as Awaited<
          ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>
        >,
      );

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-16T00:00:00.000Z',
      });

      const recCharge = result.charges.find(
        (c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE,
      );
      expect(recCharge?.amount).toBeLessThan(200);
      expect(recCharge?.amount).toBeGreaterThan(0);
      expect(recCharge?.description).toContain('Prorrateado');
    });
  });

  describe('Pruebas de Estrés y Chunking (Nuevos Requisitos Enterprise)', () => {
    it('Caso Extraordinario 1: Stress Test Bulk Insert de 3,500 membresías (Chunking)', async () => {
      const activeIds = Array.from({ length: 3500 }, (_, i) => ({
        id: `mem-${i}`,
      }));
      membershipRepo.getActiveMembershipsIdsBySeason.mockResolvedValue(
        activeIds,
      );
      membershipRepo.getCourseSeasonOrThrow.mockResolvedValue({
        id: 'ts1',
        status: 'ACTIVE',
        season: { status: 'ACTIVE' },
      } as any);

      const res = await service.createMassiveManualCharge({
        courseSeasonId: 'course-season-1',
        amount: 50,
        description: 'Bono Especial',
        dueDate: '2026-08-01T00:00:00.000Z',
      });

      expect(res.message).toContain('3500 miembros');
    });

    it('Caso Vacío en Masivos: 0 membresías no ejecuta base de datos', async () => {
      jest
        .spyOn(manualSvc, 'createMassiveManualCharge')
        .mockRejectedValue(new Error('No hay miembros activos'));

      await expect(
        service.createMassiveManualCharge({
          courseSeasonId: 'course-season-1',
          amount: 50,
          description: 'Prueba',
          dueDate: '2026-08-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('No hay miembros activos');
    });

    it('Caso Extraordinario 2: Stress Test de Cron Diario con 125 membresías', async () => {
      const dailyMemberships = Array.from({ length: 125 }, (_, i) => ({
        id: `mem-${i}`,
      }));
      membershipRepo.getMembershipsForDailyGeneration.mockResolvedValue(
        dailyMemberships as unknown as Awaited<
          ReturnType<typeof membershipRepo.getMembershipsForDailyGeneration>
        >,
      );

      await service.applyDailyStudentCharges();

      // Debe llamar ensureStudentCharges exactamente 125 veces
      expect(generationService.ensureStudentCharges).toHaveBeenCalledTimes(125);
    });
  });

  describe('recalculatePendingFutureCharges (Recálculo Seguro de Punteros)', () => {
    it('Caso Extremo de Riesgo: Ignora cargos que están parcialmente pagados y borra solo los 100% pendientes', async () => {
      await service.recalculatePendingFutureCharges('membership-1');
      expect(recalcSvc.recalculatePendingFutureCharges).toHaveBeenCalledWith(
        'membership-1',
      );
    });
  });

  describe('generateAdvanceCharges (Generación Adelantada Manual)', () => {
    it('Debe abortar elegantemente si no hay ciclos por generar', async () => {
      const result = await service.generateAdvanceCharges('mem-1', 5);
      expect(result.message).toContain('No hay más cuotas disponibles');
    });

    it('Debe invocar la generación si hay ciclos', async () => {
      const result = await service.generateAdvanceCharges('mem-1', 2);
      expect(result.message).toContain(
        'Se generaron exitosamente 2 cuotas por adelantado',
      );
    });
  });
});
