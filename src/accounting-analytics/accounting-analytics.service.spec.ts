import { Test, TestingModule } from '@nestjs/testing';
import { AccountingAnalyticsService } from './accounting-analytics.service';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType, TransactionStatus } from 'src/generated/prisma/client';

describe('AccountingAnalyticsService', () => {
  let service: AccountingAnalyticsService;
  let prisma: PrismaService;

  const mockPrisma = {
    financialAccount: { findMany: jest.fn() },
    charge: { findMany: jest.fn() },
    transaction: { findMany: jest.fn() },
    internalTransfer: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AccountingAnalyticsService>(AccountingAnalyticsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Receivables & Payables (CxC / CxP)', () => {
    const today = new Date();
    const pastDate = new Date(today.getTime() - 86400000); // Yesterday
    const futureDate = new Date(today.getTime() + 86400000); // Tomorrow

    it('should classify CxC as expired and valid correctly', async () => {
      mockPrisma.charge.findMany.mockResolvedValueOnce([
        { pendingAmount: 100, dueDate: pastDate, studentCharges: [{ id: 1 }], membershipCharges: [] }, // Expired Student
        { pendingAmount: 200, dueDate: futureDate, studentCharges: [], membershipCharges: [{ id: 1 }] }, // Valid Membership
        { pendingAmount: 50, dueDate: pastDate, studentCharges: [], membershipCharges: [], accountCharge: { id: 1 } }, // Expired General
      ]);

      const result = await service.getReceivableMetrics();
      expect(result.receivables.expired.student).toBe(100);
      expect(result.receivables.expired.general).toBe(50);
      expect(result.receivables.expired.total).toBe(150);
      expect(result.receivables.valid.membership).toBe(200);
      expect(result.receivables.valid.total).toBe(200);
      expect(result.receivables.total).toBe(350);
    });

    it('should classify CxP as expired and valid correctly', async () => {
      mockPrisma.charge.findMany.mockResolvedValueOnce([
        { pendingAmount: 500, dueDate: pastDate }, // Expired
        { pendingAmount: 300, dueDate: futureDate }, // Valid
      ]);

      const result = await service.getPayableMetrics();
      expect(result.payables.expired).toBe(500);
      expect(result.payables.valid).toBe(300);
      expect(result.payables.total).toBe(800);
    });
  });

  describe('Transactions (Income & Expenses)', () => {
    const periodStart = new Date();
    const periodEnd = new Date();

    it('should filter only COMPLETED and not Internal Transfers', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([]);
      await service.getPeriodIncome(periodStart, periodEnd);

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          status: TransactionStatus.COMPLETED,
          isInternalTransfer: false,
          type: TransactionType.INCOME,
        })
      }));
    });

    it('should group income by currency and classify correctly', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: 100, financialAccount: { currency: 'USD' }, payment: { charge: { studentCharges: [{ id: 1 }], membershipCharges: [] } } }, // School USD
        { amount: 200, financialAccount: { currency: 'BOB' }, payment: { charge: { studentCharges: [], membershipCharges: [{ id: 1 }] } } }, // Club BOB
        { amount: 50, financialAccount: { currency: 'BOB' }, payment: { charge: { studentCharges: [], membershipCharges: [], accountCharge: { category: { name: 'Donations' } } } } }, // General BOB
      ]);

      const result = await service.getPeriodIncome(periodStart, periodEnd);
      expect(result['USD'].school).toBe(100);
      expect(result['USD'].total).toBe(100);
      expect(result['BOB'].club).toBe(200);
      expect(result['BOB'].general).toBe(50);
      expect(result['BOB'].categories['Donations']).toBe(50);
      expect(result['BOB'].total).toBe(250);
    });

    it('should group expenses by currency and category correctly', async () => {
      mockPrisma.transaction.findMany.mockResolvedValueOnce([
        { amount: 100, financialAccount: { currency: 'BOB' }, payment: { charge: { accountCharge: { category: { name: 'Sueldos' } } } } },
        { amount: 50, financialAccount: { currency: 'BOB' }, payment: { charge: { accountCharge: null } } }, // Uncategorized
      ]);

      const result = await service.getPeriodExpenses(periodStart, periodEnd);
      expect(result['BOB'].categories['Sueldos']).toBe(100);
      expect(result['BOB'].uncategorized).toBe(50);
      expect(result['BOB'].total).toBe(150);
    });
  });

  describe('Internal Transfers', () => {
    it('should fetch internal transfers properly', async () => {
      const d = new Date();
      mockPrisma.internalTransfer.findMany.mockResolvedValueOnce([
        { date: d, amount: 100, sourceTransaction: { financialAccount: { name: 'Caja', currency: 'BOB' } }, destinationTransaction: { financialAccount: { name: 'Banco' } } }
      ]);

      const result = await service.getPeriodTransfers(d, d);
      expect(result[0].amount).toBe(100);
      expect(result[0].currency).toBe('BOB');
      expect(result[0].sourceAccount).toBe('Caja');
      expect(result[0].destinationAccount).toBe('Banco');
    });
  });

  describe('Global Financial Summary', () => {
    it('should calculate period result per currency correctly', async () => {
      jest.spyOn(service, 'getTreasuryMetrics').mockResolvedValue({ liquidityByCurrency: { BOB: 1000 }, accounts: [] });
      jest.spyOn(service, 'getReceivableMetrics').mockResolvedValue({ receivables: { total: 0 } } as any);
      jest.spyOn(service, 'getPayableMetrics').mockResolvedValue({ payables: { total: 0 } } as any);
      jest.spyOn(service, 'getPeriodTransfers').mockResolvedValue([]);
      
      jest.spyOn(service, 'getPeriodIncome').mockResolvedValue({
        BOB: { school: 0, club: 0, general: 0, uncategorized: 0, categories: {}, total: 500 },
        USD: { school: 0, club: 0, general: 0, uncategorized: 0, categories: {}, total: 200 },
      });
      jest.spyOn(service, 'getPeriodExpenses').mockResolvedValue({
        BOB: { categories: {}, uncategorized: 0, total: 300 },
        EUR: { categories: {}, uncategorized: 0, total: 50 }, // Only expense in EUR
      });

      const result = await service.getAccountingSummary();
      
      expect(result.periodResultByCurrency['BOB']).toBe(200); // 500 - 300
      expect(result.periodResultByCurrency['USD']).toBe(200); // 200 - 0
      expect(result.periodResultByCurrency['EUR']).toBe(-50); // 0 - 50
    });
  });
});
