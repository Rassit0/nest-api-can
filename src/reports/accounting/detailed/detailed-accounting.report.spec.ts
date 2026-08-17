import { Test, TestingModule } from '@nestjs/testing';
import { DetailedAccountingReport } from './detailed-accounting.report';
import { ReportRegistry } from '../../core/registry/report.registry';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';

describe('DetailedAccountingReport', () => {
  let report: DetailedAccountingReport;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailedAccountingReport,
        {
          provide: ReportRegistry,
          useValue: { register: jest.fn() },
        },
        {
          provide: PrinterService,
          useValue: { createPdf: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: { transaction: { findMany: jest.fn() }, accountCategory: { findUnique: jest.fn() } },
        },
      ],
    }).compile();

    report = module.get<DetailedAccountingReport>(DetailedAccountingReport);
  });

  describe('groupAccountingData (No Doble Contabilización y Clasificación Fase 5)', () => {
    
    it('TEST 1: Payment con una Transaction (cantidad = 1)', () => {
      const transactions = [
        {
          id: 't1', amount: 100, type: 'INCOME', paymentMethod: 'CASH',
          payment: {
            id: 'p1', receiptSeries: 'ESC', receiptNumber: 1,
            charge: { studentCharges: [{ studentMembership: { courseSeason: { course: { school: { defaultAccountCategory: { id: 'c1', name: 'Escuelas', code: 'ESC' } } } } } }] }
          }
        }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      
      expect(groups.length).toBe(1);
      expect(groups[0].categoryName).toBe('ESCUELAS');
      expect(groups[0].documentIds.size).toBe(1);
      expect(groups[0].cash).toBe(100);
      expect(groups[0].children[0].receiptSeries).toBe('ESC');
      expect(groups[0].children[0].documentIds.size).toBe(1);
    });

    it('TEST 2: Payment con dos Transactions (cantidad = 1, montos sumados)', () => {
      const transactions = [
        { id: 't1', amount: 100, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'EQP', receiptNumber: 2, charge: null } },
        { id: 't2', amount: 50, type: 'INCOME', paymentMethod: 'QR', payment: { id: 'p1', receiptSeries: 'EQP', receiptNumber: 2, charge: null } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      
      expect(groups[0].categoryName).toBe('EQUIPOS');
      expect(groups[0].documentIds.size).toBe(1); // 1 Payment Document
      expect(groups[0].cash).toBe(100);
      expect(groups[0].qr).toBe(50);
      expect(groups[0].total).toBe(150);
    });

    it('TEST 3: Pago parcial (Charge = 500, Payment A = 200, Payment B = 300) -> 2 documentos', () => {
      const transactions = [
        { id: 't1', amount: 200, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'pA', receiptSeries: 'ESC-MAT', receiptNumber: 3, charge: null } },
        { id: 't2', amount: 300, type: 'INCOME', paymentMethod: 'TRANSFER', payment: { id: 'pB', receiptSeries: 'ESC-MAT', receiptNumber: 4, charge: null } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      
      expect(groups[0].categoryName).toBe('ESCUELAS');
      expect(groups[0].documentIds.size).toBe(2);
      expect(groups[0].cash).toBe(200);
      expect(groups[0].transfer).toBe(300);
      expect(groups[0].total).toBe(500);
    });

    it('TEST 4 y 5: Payment histórico EQ y CU', () => {
      const transactions = [
        { id: 't1', amount: 100, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'pEQ', receiptSeries: 'EQ', receiptNumber: 15, charge: null } },
        { id: 't2', amount: 150, type: 'INCOME', paymentMethod: 'QR', payment: { id: 'pCU', receiptSeries: 'CU', receiptNumber: 8, charge: null } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      
      expect(groups[0].categoryName).toBe('OTROS / HISTÓRICO');
      const children = groups[0].children;
      expect(children.length).toBe(2);
      expect(children.some((c: any) => c.receiptSeries === 'EQ')).toBeTruthy();
      expect(children.some((c: any) => c.receiptSeries === 'CU')).toBeTruthy();
    });

    it('TEST 6 y 7: Payment nuevo ESC y EQP', () => {
      const transactions = [
        { id: 't1', amount: 100, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'ESC', receiptNumber: 20, charge: null } },
        { id: 't2', amount: 150, type: 'INCOME', paymentMethod: 'QR', payment: { id: 'p2', receiptSeries: 'EQP', receiptNumber: 5, charge: null } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      expect(groups.length).toBe(2);
      expect(groups.some((g: any) => g.categoryName === 'ESCUELAS')).toBeTruthy();
      expect(groups.some((g: any) => g.categoryName === 'EQUIPOS')).toBeTruthy();
    });

    it('TEST 8: Recargos (ESC-REC y EQP-REC)', () => {
      const transactions = [
        { id: 't1', amount: 50, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'ESC-REC', receiptNumber: 1, charge: null } },
        { id: 't2', amount: 50, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p2', receiptSeries: 'EQP-REC', receiptNumber: 2, charge: null } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      expect(groups.some((g: any) => g.categoryName === 'ESCUELAS' && g.children.some((c: any) => c.receiptSeries === 'ESC-REC'))).toBeTruthy();
      expect(groups.some((g: any) => g.categoryName === 'EQUIPOS' && g.children.some((c: any) => c.receiptSeries === 'EQP-REC'))).toBeTruthy();
    });

    it('TEST 9: Transaction sin Payment (Gasto)', () => {
      const transactions = [
        { id: 't1', amount: 100, type: 'EXPENSE', paymentMethod: 'TRANSFER', receiptSeries: 'EGR', receiptNumber: 99 }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      
      expect(groups[0].categoryName).toBe('OTROS / HISTÓRICO');
      expect(groups[0].children[0].receiptSeries).toBe('EGR');
      expect(groups[0].transfer).toBe(-100);
      expect(groups[0].documentIds.size).toBe(1);
    });

    it('TEST 11: Un Payment con 3 Transactions (CASH + QR + BANCO)', () => {
      const transactions = [
        { id: 't1', amount: 10, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'GEN', receiptNumber: 1 } },
        { id: 't2', amount: 20, type: 'INCOME', paymentMethod: 'QR', payment: { id: 'p1', receiptSeries: 'GEN', receiptNumber: 1 } },
        { id: 't3', amount: 30, type: 'INCOME', paymentMethod: 'TRANSFER', payment: { id: 'p1', receiptSeries: 'GEN', receiptNumber: 1 } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      expect(groups[0].documentIds.size).toBe(1);
      expect(groups[0].cash).toBe(10);
      expect(groups[0].qr).toBe(20);
      expect(groups[0].transfer).toBe(30);
      expect(groups[0].total).toBe(60);
    });

    it('TEST 12: AccountCharge Personalizado', () => {
      const transactions = [
        { id: 't1', amount: 10, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'ARBI-37b2', receiptNumber: 1, charge: { accountCharge: { category: { id: 'c1', name: 'Arbitraje', code: 'ARBI-37b2', isActive: true } } } } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      expect(groups.some((g: any) => g.categoryName === 'PERSONALIZADOS')).toBeTruthy();
      expect(groups[0].children[0].receiptSeries).toBe('ARBI-37b2');
    });

    it('TEST 14: Categoría antigua inactiva (ej EQP-CAN) va a HISTÓRICO', () => {
      const transactions = [
        { id: 't1', amount: 10, type: 'INCOME', paymentMethod: 'CASH', payment: { id: 'p1', receiptSeries: 'EQ', receiptNumber: 1, charge: { accountCharge: { category: { id: 'c1', name: 'CAN', code: 'EQP-CAN', isActive: false } } } } }
      ];
      const groups = (report as any).groupAccountingData(transactions);
      expect(groups[0].categoryName).toBe('OTROS / HISTÓRICO');
    });
  });
});
