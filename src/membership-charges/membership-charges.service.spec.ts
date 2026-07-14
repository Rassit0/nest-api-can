import { Test, TestingModule } from '@nestjs/testing';
import { MembershipChargesService } from './membership-charges.service';
import { PrismaService } from 'src/prisma.service';
import { Prisma, TypeMembershipCharge } from 'src/generated/prisma/client';
import { PreviewCharge } from './interfaces/membership-charge.types';
import { MembershipPreviewService } from './services/membership-preview.service';
import { MembershipGenerationService } from './services/membership-generation.service';
import { MembershipRepository } from './repositories/membership.repository';
import { MembershipChargeRepository } from './repositories/membership-charge.repository';
import { DateUtils } from 'src/utils/date.utils';

describe('MembershipChargesService (Financial Engine - Extremo)', () => {
  let service: MembershipChargesService;
  let membershipRepo: jest.Mocked<MembershipRepository>;
  let chargeRepo: jest.Mocked<MembershipChargeRepository>;
  let generationService: jest.Mocked<MembershipGenerationService>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    };
    
    const mockMembershipRepo = {
      getTeamSeasonOrThrow: jest.fn(),
      getPaymentPlanOrThrow: jest.fn(),
      getMembershipOrThrow: jest.fn(),
      getMembershipById: jest.fn(),
      getActiveMembershipsIdsBySeason: jest.fn(),
      getMembershipsForDailyGeneration: jest.fn(),
      updateNextGenerationPointer: jest.fn(),
    };

    const mockChargeRepo = {
      fetchExistingCharges: jest.fn(),
      fetchPendingFutureMembershipCharges: jest.fn(),
      bulkCreateCharges: jest.fn(),
      bulkCreateMembershipCharges: jest.fn(),
      deletePendingCharges: jest.fn(),
    };

    const mockGenerationService = {
      ensureMembershipCharges: jest.fn(),
      ensureRecurringCharges: jest.fn(),
      findNextUngeneratedCycles: jest.fn(),
      generateAdvanceCharges: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipChargesService,
        MembershipPreviewService, // Inyección real para mantener tests de cálculo matemático de ciclos
        { provide: MembershipGenerationService, useValue: mockGenerationService },
        { provide: MembershipRepository, useValue: mockMembershipRepo },
        { provide: MembershipChargeRepository, useValue: mockChargeRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MembershipChargesService>(MembershipChargesService);
    membershipRepo = module.get(MembershipRepository);
    chargeRepo = module.get(MembershipChargeRepository);
    generationService = module.get(MembershipGenerationService);
    prisma = module.get(PrismaService);
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

    const mockTeamSeason = {
      id: 'team-season-1',
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
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue(mockTeamSeason as unknown as Awaited<ReturnType<typeof membershipRepo.getTeamSeasonOrThrow>>);
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(basePlan as unknown as Awaited<ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>>);

      const result = await service.previewCharges({
        teamSeasonId: 'team-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      expect(result.charges.length).toBe(2);
      
      const regCharge = result.charges.find((c: PreviewCharge) => c.type === TypeMembershipCharge.REGISTRATION);
      expect(regCharge?.amount).toBe(100);

      const recCharge = result.charges.find((c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharge?.amount).toBe(200);
      expect(recCharge?.description).toContain('Primera Mensualidad - Enero 2026');
    });

    it('Caso 2: Cobro Agrupado (Trimestral, advanceCycles = 3, sin descuento)', async () => {
      const trimestralPlan = { ...basePlan, advanceCycles: 3 };
      
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue(mockTeamSeason as unknown as Awaited<ReturnType<typeof membershipRepo.getTeamSeasonOrThrow>>);
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(trimestralPlan as unknown as Awaited<ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>>);

      const result = await service.previewCharges({
        teamSeasonId: 'team-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter((c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(200);
      expect(recCharges[0].description).toContain('Mensualidad');
    });

    it('Caso 3: Cobro Agrupado con Descuento Adelantado (advanceCycles = 3, discount = 100%)', async () => {
      const trimestralPromoPlan = { ...basePlan, advanceCycles: 3, advanceCyclesDiscountPercent: 100 };
      
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue(mockTeamSeason as unknown as Awaited<ReturnType<typeof membershipRepo.getTeamSeasonOrThrow>>);
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(trimestralPromoPlan as unknown as Awaited<ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>>);

      const result = await service.previewCharges({
        teamSeasonId: 'team-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const recCharges = result.charges.filter((c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharges.length).toBe(3);
      expect(recCharges[0].amount).toBe(0); // 100% discount
      expect(recCharges[0].discountAmount).toBe(200); 
    });

    it('Caso 4: Pago Único de Temporada (isSinglePayment = true)', async () => {
      const singlePlan = { ...basePlan, isSinglePayment: true, seasonFeeDiscountPercent: 10 };
      const teamSeasonSingle = { ...mockTeamSeason, billingConfig: { ...mockTeamSeason.billingConfig, billingType: 'SINGLE_ONLY', seasonFee: 2000 } };
      
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue(teamSeasonSingle as unknown as Awaited<ReturnType<typeof membershipRepo.getTeamSeasonOrThrow>>);
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(singlePlan as unknown as Awaited<ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>>);

      const result = await service.previewCharges({
        teamSeasonId: 'team-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-01T00:00:00.000Z',
      });

      const seasonCharge = result.charges.find((c: PreviewCharge) => c.type === TypeMembershipCharge.SEASON_FEE);
      expect(seasonCharge?.amount).toBe(1800); // 2000 - 10%
      expect(seasonCharge?.discountAmount).toBe(200);
    });

    it('Caso 5: Prorrateo primera cuota (Ingreso a mitad de mes)', async () => {
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue(mockTeamSeason as unknown as Awaited<ReturnType<typeof membershipRepo.getTeamSeasonOrThrow>>);
      membershipRepo.getPaymentPlanOrThrow.mockResolvedValue(basePlan as unknown as Awaited<ReturnType<typeof membershipRepo.getPaymentPlanOrThrow>>);

      const result = await service.previewCharges({
        teamSeasonId: 'team-season-1',
        paymentPlanId: 'plan-1',
        startDate: '2026-01-16T00:00:00.000Z', 
      });

      const recCharge = result.charges.find((c: PreviewCharge) => c.type === TypeMembershipCharge.RECURRING_FEE);
      expect(recCharge?.amount).toBeLessThan(200);
      expect(recCharge?.amount).toBeGreaterThan(0);
      expect(recCharge?.description).toContain('Prorrateado');
    });
  });

  describe('Pruebas de Estrés y Chunking (Nuevos Requisitos Enterprise)', () => {
    
    it('Caso Extraordinario 1: Stress Test Bulk Insert de 3,500 membresías (Chunking)', async () => {
      const activeIds = Array.from({ length: 3500 }, (_, i) => ({ id: `mem-${i}` }));
      membershipRepo.getActiveMembershipsIdsBySeason.mockResolvedValue(activeIds);
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue({ id: 'ts1', status: 'ACTIVE', season: { status: 'ACTIVE' } } as any);

      const res = await service.createMassiveManualCharge({
        teamSeasonId: 'team-season-1',
        amount: 50,
        description: 'Bono Especial',
        dueDate: '2026-08-01T00:00:00.000Z'
      } as unknown as Parameters<typeof service.createMassiveManualCharge>[0]);

      expect(res.message).toContain('3500 miembros');
      
      // Lotes de 1000 = 4 interacciones
      expect(chargeRepo.bulkCreateCharges).toHaveBeenCalledTimes(4);
      expect(chargeRepo.bulkCreateMembershipCharges).toHaveBeenCalledTimes(4);
      
      // Primer chunk debe tener 1000 elementos
      expect(chargeRepo.bulkCreateCharges.mock.calls[0][1].length).toBe(1000);
      // Último chunk debe tener 500 elementos
      expect(chargeRepo.bulkCreateCharges.mock.calls[3][1].length).toBe(500);
    });

    it('Caso Vacío en Masivos: 0 membresías no ejecuta base de datos', async () => {
      membershipRepo.getActiveMembershipsIdsBySeason.mockResolvedValue([]);
      membershipRepo.getTeamSeasonOrThrow.mockResolvedValue({ id: 'ts1', status: 'ACTIVE', season: { status: 'ACTIVE' } } as any);

      await expect(service.createMassiveManualCharge({
        teamSeasonId: 'team-season-1',
        amount: 50,
        description: 'Prueba',
        dueDate: '2026-08-01T00:00:00.000Z'
      } as Parameters<typeof service.createMassiveManualCharge>[0])).rejects.toThrow('No hay miembros activos');

      expect(chargeRepo.bulkCreateCharges).not.toHaveBeenCalled();
    });

    it('Caso Extraordinario 2: Stress Test de Cron Diario con 125 membresías', async () => {
      const dailyMemberships = Array.from({ length: 125 }, (_, i) => ({ id: `mem-${i}` }));
      membershipRepo.getMembershipsForDailyGeneration.mockResolvedValue(dailyMemberships as unknown as Awaited<ReturnType<typeof membershipRepo.getMembershipsForDailyGeneration>>);

      await service.applyDailyMembershipCharges();

      // Debe llamar ensureMembershipCharges exactamente 125 veces
      expect(generationService.ensureMembershipCharges).toHaveBeenCalledTimes(125);
    });
  });

  describe('recalculatePendingFutureCharges (Recálculo Seguro de Punteros)', () => {
    it('Caso Extremo de Riesgo: Ignora cargos que están parcialmente pagados y borra solo los 100% pendientes', async () => {
      const mockCharges = [
        { chargeId: 'fut-1', type: TypeMembershipCharge.RECURRING_FEE, charge: { dueDate: new Date('2026-07-01T00:00:00.000Z'), status: 'PENDING', amount: 200, pendingAmount: 200 } },
        { chargeId: 'fut-2', type: TypeMembershipCharge.RECURRING_FEE, charge: { dueDate: new Date('2026-08-01T00:00:00.000Z'), status: 'PENDING', amount: 200, pendingAmount: 100 } } // Pagó la mitad
      ];

      chargeRepo.fetchPendingFutureMembershipCharges.mockResolvedValue(mockCharges as unknown as Awaited<ReturnType<typeof chargeRepo.fetchPendingFutureMembershipCharges>>);
      membershipRepo.getMembershipById.mockResolvedValue({ id: 'mem-1', teamSeason: { billingConfig: { chargeGenerationDaysBefore: 15 } } } as unknown as Awaited<ReturnType<typeof membershipRepo.getMembershipById>>);

      await service.recalculatePendingFutureCharges('membership-1');

      // Solo debe borrar 'fut-1' porque 'fut-2' tiene pago parcial
      expect(chargeRepo.deletePendingCharges).toHaveBeenCalledWith(expect.anything(), ['fut-1']);
    });
  });

  describe('generateAdvanceCharges (Generación Adelantada Manual)', () => {
    it('Debe abortar elegantemente si no hay ciclos por generar', async () => {
      membershipRepo.getMembershipOrThrow.mockResolvedValue({ id: 'mem-1', teamSeason: { status: 'ACTIVE', season: { status: 'ACTIVE' } } } as any);
      generationService.findNextUngeneratedCycles.mockResolvedValue([]);

      const result = await service.generateAdvanceCharges('mem-1', 5);

      expect(result.message).toContain('No hay más cuotas disponibles');
      expect(generationService.generateAdvanceCharges).not.toHaveBeenCalled();
    });

    it('Debe invocar la generación si hay ciclos', async () => {
      membershipRepo.getMembershipOrThrow.mockResolvedValue({ id: 'mem-1', teamSeason: { status: 'ACTIVE', season: { status: 'ACTIVE' } } } as any);
      generationService.findNextUngeneratedCycles.mockResolvedValue([{}, {}] as unknown as ReturnType<typeof generationService.findNextUngeneratedCycles>);

      const result = await service.generateAdvanceCharges('mem-1', 2);

      expect(result.message).toContain('Se generaron exitosamente 2 cuotas por adelantado');
      expect(generationService.generateAdvanceCharges).toHaveBeenCalledTimes(1);
    });
  });
});
