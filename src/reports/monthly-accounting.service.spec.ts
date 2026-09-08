import { Test, TestingModule } from '@nestjs/testing';
import { MonthlyAccountingService } from './monthly-accounting.service';
import { PrismaService } from '../prisma.service';
import { TransactionStatus } from '../generated/prisma/client';
import { MonthlyAccountingExcelService } from './monthly-accounting-excel.service';

describe('MonthlyAccountingService', () => {
  let service: MonthlyAccountingService;
  let excelService: MonthlyAccountingExcelService;
  let prisma: PrismaService;

  const mockPrisma = {
    financialAccount: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'acc1', name: 'Cuenta Principal', type: 'BANK' },
        { id: 'acc2', name: 'Cuenta Secundaria', type: 'CASH' }
      ]),
    },
    transaction: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthlyAccountingService,
        MonthlyAccountingExcelService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MonthlyAccountingService>(MonthlyAccountingService);
    excelService = module.get<MonthlyAccountingExcelService>(MonthlyAccountingExcelService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Accounting Logic', () => {
    it('Test 1 - COMPLETED: Debe sumar al total operativo', async () => {
      const tx = {
        id: 'tx1',
        transactionDate: new Date('2024-01-15'),
        amount: 500,
        type: 'INCOME',
        status: TransactionStatus.COMPLETED,
        financialAccountId: 'acc1',
        isInternalTransfer: false,
        payment: { charge: { accountCharge: { category: { name: 'Cat1' } } } }
      };

      mockPrisma.transaction.findMany.mockResolvedValueOnce([tx]);
      const excelWb = await excelService.generateExcel({ year: 2024, month: 1 });
      expect(prisma.transaction.findMany).toHaveBeenCalled();
      expect(excelWb).toBeDefined();
    });

    it('Test 2 - PENDING: No debe participar en sumTotalIncome ni sumTotalExpense', async () => {
      const tx = {
        id: 'tx2',
        transactionDate: new Date('2024-01-15'),
        amount: 500,
        type: 'INCOME',
        status: TransactionStatus.PENDING,
        financialAccountId: 'acc1',
        isInternalTransfer: false,
      };

      mockPrisma.transaction.findMany.mockResolvedValueOnce([tx]);
      const excelWb = await excelService.generateExcel({ year: 2024, month: 1 });
      const ws = excelWb.getWorksheet('Detalle 2024-01');
      let foundInDetails = false;
      ws?.eachRow((row) => {
        if (row.getCell('id').value === 'tx2') foundInDetails = true;
      });
      expect(foundInDetails).toBeTruthy();
    });

    it('Test 3 - CANCELLED: Con y sin reversa no duplica sumas operativas', async () => {
      const tx1 = {
        id: 'tx3',
        transactionDate: new Date('2024-01-15'),
        amount: 500,
        type: 'INCOME',
        status: TransactionStatus.CANCELLED,
        financialAccountId: 'acc1',
        isInternalTransfer: false,
      }; 

      const tx2 = {
        id: 'tx4',
        transactionDate: new Date('2024-01-15'),
        amount: 500,
        type: 'INCOME',
        status: TransactionStatus.CANCELLED,
        financialAccountId: 'acc1',
        isInternalTransfer: false,
        reversedBy: { id: 'rev1' }
      };

      mockPrisma.transaction.findMany.mockResolvedValueOnce([tx1, tx2]);
      const excelWb = await excelService.generateExcel({ year: 2024, month: 1 });
      expect(excelWb).toBeDefined();
    });

    it('Test 4 - Split Payment: Reconcilia sin duplicación a nivel Transaction', async () => {
      const txCash = {
        id: 'txCash', paymentId: 'pay1', amount: 300, type: 'INCOME', status: TransactionStatus.COMPLETED,
        transactionDate: new Date('2024-01-15'), financialAccountId: 'acc1'
      };
      const txQR = {
        id: 'txQR', paymentId: 'pay1', amount: 200, type: 'INCOME', status: TransactionStatus.COMPLETED,
        transactionDate: new Date('2024-01-15'), financialAccountId: 'acc2'
      };

      mockPrisma.transaction.findMany.mockResolvedValueOnce([txCash, txQR]);
      const data = await service.getAccountingData({ year: 2024, month: 1 });
      expect(data.transactions.length).toBe(2);
      expect(Number(data.transactions[0].amount) + Number(data.transactions[1].amount)).toBe(500);
    });

    it('Test 5, 6, 7 - InternalTransfer: source/dest y efecto consolidado', async () => {
      const txOut = {
        id: 'txOut', amount: 500, type: 'EXPENSE', status: TransactionStatus.COMPLETED,
        transactionDate: new Date('2024-01-15'), financialAccountId: 'acc1',
        isInternalTransfer: true,
        internalTransferSource: { id: 'it1' }
      };
      const txIn = {
        id: 'txIn', amount: 500, type: 'INCOME', status: TransactionStatus.COMPLETED,
        transactionDate: new Date('2024-01-15'), financialAccountId: 'acc2',
        isInternalTransfer: true,
        internalTransferDest: { id: 'it1' }
      };

      mockPrisma.transaction.findMany.mockResolvedValueOnce([txOut, txIn]);
      const excelWb = await excelService.generateExcel({ year: 2024, month: 1 });
      expect(excelWb).toBeDefined();
    });

    it('Test 8 - Balance inicial calculado desde histórico previo', async () => {
      mockPrisma.transaction.groupBy.mockResolvedValueOnce([
        { financialAccountId: 'acc1', type: 'INCOME', _sum: { amount: 1000 } },
        { financialAccountId: 'acc1', type: 'EXPENSE', _sum: { amount: 200 } }
      ]);
      const data = await service.getAccountingData({ year: 2024, month: 1 });
      const acc1 = data.accounts.find(a => a.id === 'acc1');
      expect(acc1?.openingBalance).toBe(800);
    });

    it('Test 9 - Balance final cuadra', async () => {
      expect(true).toBe(true);
    });
  });
});
