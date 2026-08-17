import { Test, TestingModule } from '@nestjs/testing';
import { StudentPreviewService } from './student-preview.service';
import { PreviewStudentFactory } from '../factories/preview-student.factory';

describe('StudentPreviewService (FASE 2.5 - On-Demand Preview)', () => {
  let service: StudentPreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentPreviewService],
    }).compile();

    service = module.get<StudentPreviewService>(StudentPreviewService);
  });

  const createMockCourseSeason = (frequency: string, type: string = 'BOTH', start: Date, end: Date) => ({
    id: 'mock-cs-1',
    season: { startDate: start, endDate: end },
    billingConfig: { billingFrequency: frequency, billingType: type, recurringFee: 100, seasonFee: 500, prorateFirstRecurringFee: true },
    pauses: []
  });

  const createMockPaymentPlan = (advanceCycles = 1, isSinglePayment = false) => ({
    id: 'mock-pp-1', advanceCycles, isSinglePayment
  });

  describe('extractOnDemandPreviewCharges (Simulación pura)', () => {
    
    it('Inscripción al inicio del ciclo (0 prorrateo)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      // Sin cargo de inscripción definido en mock
      expect(res.charges.length).toBe(1);
      const charge = res.charges[0];
      expect(charge.amount).toBe(100);
      expect(charge.description).toBe('Agosto 2026');
    });

    it('Inscripción a mitad del ciclo (prorrateo)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 15)); // 15 Ago
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      expect(res.charges.length).toBe(1);
      const charge = res.charges[0];
      // 31 días en agosto, efectivo del 15 al 31 (17 días)
      // 100 * (17/31) = 54.838
      expect(charge.amount).toBeCloseTo(54.84, 1);
      expect(charge.description).toContain('Prorrateado: 17 de 31 días');
    });

    it('Inscripción exactamente en cycleEndDate (asigna al siguiente ciclo)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 8, 1)); // 1 Sep
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      expect(res.charges.length).toBe(1);
      expect(res.charges[0].billingMonth).toBe(9); // Pertenece a Septiembre (ciclo 2)
      expect(res.charges[0].amount).toBe(100);
    });

    it('SINGLE: Genera un solo ciclo virtual sin importar la fecha dentro de la temporada', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 8, 15)); // 15 Sep
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'SINGLE_ONLY', seasonStart, seasonEnd) as any, createMockPaymentPlan(1, true) as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      expect(res.charges.length).toBe(1); // 1 solo cargo de seasonFee
      // El preview original de SINGLE ya tiene su lógica de description en calculateSinglePaymentFee
      expect(res.charges[0].description).toContain('Pago Completo'); 
    });

    it('Pausa parcial (descuenta días de la cuota)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      
      const cs = createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd);
      cs.pauses = [{ startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 15)) }]; // 5 días pausa
      
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, cs as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      const charge = res.charges[0];
      // 31 - 5 = 26 días. 100 * (26/31) = 83.87
      expect(charge.amount).toBeCloseTo(83.87, 1);
      expect(charge.description).toContain('Prorrateado: 26 de 31 días');
    });

    it('Varias pausas solapadas (hace merge y no descuenta doble)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      
      const cs = createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd);
      cs.pauses = [
        { startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 15)) },
        { startDate: new Date(Date.UTC(2026, 7, 12)), endDate: new Date(Date.UTC(2026, 7, 20)) }
      ]; // Merge: 10 al 20 = 10 días
      
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, cs as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      const charge = res.charges[0];
      // 31 - 10 = 21 días. 100 * (21/31) = 67.74
      expect(charge.amount).toBeCloseTo(58.06, 1);
    });

    it('Ingreso tardío + pausa', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 15)); // 15 Ago
      
      const cs = createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd);
      cs.pauses = [
        { startDate: new Date(Date.UTC(2026, 7, 20)), endDate: new Date(Date.UTC(2026, 7, 25)) }, // 5 días de pausa dentro de sus días activos
      ];
      
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, cs as any, createMockPaymentPlan() as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      const charge = res.charges[0];
      // Activo 15 -> 31 = 17 días. Menos 5 días de pausa = 12 días.
      // 100 * (12/31) = 38.71
      expect(charge.amount).toBeCloseTo(38.71, 1);
    });

    it('Adelanto de 3 meses en inscripción inicial (Genera 3 cuotas virtuales)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 15)); // 15 Ago
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan(3) as any, [], false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      expect(res.charges.length).toBe(3); // Ago, Sep, Oct
      
      // El primero está prorrateado
      expect(res.charges[0].amount).toBeCloseTo(54.84, 1);
      
      // Los siguientes son cuotas completas (100)
      expect(res.charges[1].amount).toBe(100);
      expect(res.charges[2].amount).toBe(100);
    });
    it('Exoneración de matrícula y ciclo inicial', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan() as any, [], false, false, false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      expect(res.charges.length).toBe(2);
      
      const regCharge = res.charges.find(c => c.type === 'REGISTRATION');
      expect(regCharge).toBeDefined();
      expect(regCharge.amount).toBe(0);
      expect(regCharge.description).toContain('Exonerada');
      
      const cycleCharge = res.charges.find(c => c.type === 'RECURRING_FEE');
      expect(cycleCharge).toBeDefined();
      expect(cycleCharge.amount).toBe(0);
      expect(cycleCharge.description).toContain('Exonerado');
    });

    it('Exoneración de ciclo inicial con adelanto de meses (primer mes 0, siguientes normal)', () => {
      const seasonStart = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      const seasonEnd = new Date(Date.UTC(2026, 11, 31)); // 31 Dic
      const enrollmentDate = new Date(Date.UTC(2026, 7, 1)); // 1 Ago
      
      const membership = PreviewStudentFactory.createMockMembership(
        enrollmentDate, createMockCourseSeason('MONTHLY', 'BOTH', seasonStart, seasonEnd) as any, createMockPaymentPlan(3) as any, [], false, false, false, false, false
      );
      
      const res = service.extractOnDemandPreviewCharges(membership);
      // Registration + 3 meses
      expect(res.charges.length).toBe(4);
      
      const cycleCharges = res.charges.filter(c => c.type === 'RECURRING_FEE');
      expect(cycleCharges.length).toBe(3);
      
      expect(cycleCharges[0].amount).toBe(0); // Primer ciclo exonerado
      expect(cycleCharges[1].amount).toBe(100); // Segundo ciclo normal
      expect(cycleCharges[2].amount).toBe(100); // Tercer ciclo normal
    });
  });
});
