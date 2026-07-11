import { Test, TestingModule } from '@nestjs/testing';
import { StudentChargesService } from './student-charges.service';
import { PrismaService } from 'src/prisma.service';
import { TypeMembershipCharge } from 'src/generated/prisma/client';

describe('StudentChargesService (Financial Engine)', () => {
  let service: StudentChargesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentChargesService,
        {
          provide: PrismaService,
          useValue: {
            courseSeason: {
              findUnique: jest.fn(),
            },
            paymentPlan: {
              findUnique: jest.fn(),
            },
            studentMembership: {
              findUnique: jest.fn(),
            },
            membershipCharge: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            studentCharge: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            charge: {
              deleteMany: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StudentChargesService>(StudentChargesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('previewCharges (Generación Matemática de Cobros)', () => {
    const mockSeason = {
      id: 'season-1',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
    };

    const mockCourseSeason = {
      id: 'course-season-1',
      billingType: 'MONTHLY',
      billingFrequency: 'MONTHLY',
      billingDay: 1,
      registrationFee: 100,
      recurringFee: 200,
      seasonFee: null,
      season: mockSeason,
      prorateFirstRecurringFee: true,
      prorateRegistrationFee: false,
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
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(basePlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      expect(result.charges.length).toBe(2);
      
      const regCharge = result.charges.find((c: any) => c.type === TypeMembershipCharge.REGISTRATION);
      expect(regCharge?.amount).toBe(100);

      const recCharge = result.charges.find((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharge?.amount).toBe(200);
      expect(recCharge?.description).toContain('Primera Mensualidad - Enero 2026');
    });

    it('Caso 2: Cobro Agrupado con Descuento Adelantado (advanceCycles = 3, discount = 100%)', async () => {
      const trimestralPromoPlan = { ...basePlan, advanceCycles: 3, advanceCyclesDiscountPercent: 100 };
      
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(trimestralPromoPlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(0); // 100% discount on 200
      expect(recCharges[0].discountAmount).toBe(200); 
      expect(recCharges[0].description).toContain('Descuento Pago Adelantado');
    });

    it('Caso 3: Cobro Agrupado (Trimestral, advanceCycles = 3, sin descuento)', async () => {
      const trimestralPlan = { ...basePlan, advanceCycles: 3 };
      
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(trimestralPlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(200); // Individual charge is 200
      expect(recCharges[0].description).toContain('Mensualidad');
    });

    it('Caso 4: Pago Único de Temporada (isSinglePayment = true)', async () => {
      const singlePlan = { ...basePlan, isSinglePayment: true, seasonFeeDiscountPercent: 10 };
      const courseSeasonSingle = { ...mockCourseSeason, billingType: 'SINGLE_ONLY', seasonFee: 2000 };
      
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(courseSeasonSingle);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(singlePlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const seasonCharge = result.charges.find((c: any) => c.type === TypeMembershipCharge.SEASON_FEE);
      expect(seasonCharge?.amount).toBe(1800); // 2000 - 10%
      expect(seasonCharge?.discountAmount).toBe(200);
      expect(seasonCharge?.description).toContain('Pago Completo - Temporada (Descuento de 10% - Plan de pago)');
    });

    it('Caso 5: Prorrateo primera cuota (Ingreso el 16 del mes)', async () => {
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(basePlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-16T00:00:00.000Z', // Ingresa el día 16
      });

      const recCharge = result.charges.find((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      // El mes tiene 31 dias.
      expect(recCharge?.amount).toBeLessThan(200);
      expect(recCharge?.amount).toBeGreaterThan(0);
      expect(recCharge?.description).toContain('Prorrateado');
    });

    it('Caso 6: Acumulación de descuentos topada al 100% (Descuento Plan + Descuento Beca)', async () => {
      const promoPlan = { ...basePlan, recurringDiscountPercent: 60 };
      
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(promoPlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
        studentDiscounts: [{
          id: 'desc-1',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: null,
          recurringDiscountPercent: 60,
          reason: 'Beca Escolar'
        } as any]
      });

      const recCharge = result.charges.find((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      // 60% del plan + 60% de beca = 120%, pero debe estar topado a 100%
      expect(recCharge?.amount).toBe(0);
      expect(recCharge?.discountAmount).toBe(200);
    });

    it('Caso Extraordinario 1: advanceCycles extremadamente alto (200) superando el fin de temporada', async () => {
      const extremePlan = { ...basePlan, advanceCycles: 200 };
      
      (prismaService.courseSeason.findUnique as jest.Mock).mockResolvedValue(mockCourseSeason);
      (prismaService.paymentPlan.findUnique as jest.Mock).mockResolvedValue(extremePlan);

      const result = await service.previewCharges({
        courseSeasonId: 'course-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter((c: any) => c.type === TypeMembershipCharge.RECURRING_FEE);
      // Solo hay 12 meses en la temporada de 2026, por lo que el advanceCycles de 200 debe topar a 12.
      expect(recCharges.length).toBe(12);
    });
  });

  describe('recalculatePendingFutureCharges', () => {
    it('Caso 7: Solo debe borrar cargos totalmente PENDING, ignorando los pagados parcialmente', async () => {
      const mockCharges = [
        { chargeId: 'fut-1', charge: { dueDate: new Date('2026-07-01T00:00:00.000Z'), status: 'PENDING', amount: 200, pendingAmount: 200 } },
        { chargeId: 'fut-2', charge: { dueDate: new Date('2026-08-01T00:00:00.000Z'), status: 'PENDING', amount: 200, pendingAmount: 100 } }
      ];

      (prismaService.studentCharge.findMany as jest.Mock).mockResolvedValue(mockCharges);

      (prismaService.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(prismaService);
      });

      await service.recalculatePendingFutureCharges('membership-1');

      expect(prismaService.studentCharge.deleteMany).toHaveBeenCalledWith({
        where: { chargeId: { in: ['fut-1'] } }
      });
      expect(prismaService.charge.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['fut-1'] } }
      });
    });
  });
});
