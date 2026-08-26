import { Test, TestingModule } from '@nestjs/testing';
import { MonthlyCashflowService } from './monthly-cashflow.service';
import { PrismaService } from 'src/prisma.service';

describe('MonthlyCashflowService', () => {
  let service: MonthlyCashflowService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthlyCashflowService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MonthlyCashflowService>(MonthlyCashflowService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate opening balance correctly', async () => {
    jest.spyOn(prisma.transaction, 'aggregate').mockImplementation((async ({ where }: any) => {
      if (where.type === 'INCOME') return { _sum: { amount: 5000 } };
      if (where.type === 'EXPENSE') return { _sum: { amount: 1500 } };
      return { _sum: { amount: 0 } };
    }) as any);

    jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    const data = await service.getCashflowData({ year: 2026, month: 8 });

    expect(data.openingBalance).toBe(3500);
    expect(data.closingBalance).toBe(3500); // Porque no hay movimientos en el mes
  });

  it('should group transactions by day and columns properly', async () => {
    jest.spyOn(prisma.transaction, 'aggregate').mockResolvedValue({ _sum: { amount: 0 } } as any);

    jest.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
      {
        id: '1',
        transactionDate: new Date(Date.UTC(2026, 7, 1, 10, 0, 0)), // 1 de Agosto
        type: 'INCOME',
        amount: 200 as any,
        paymentMethod: 'CASH',
        isInternalTransfer: false,
        financialAccountId: 'acc1',
        financialAccount: { name: 'Caja General' },
      } as any,
      {
        id: '2',
        transactionDate: new Date(Date.UTC(2026, 7, 1, 14, 0, 0)), // 1 de Agosto
        type: 'INCOME',
        amount: 300 as any,
        paymentMethod: 'QR',
        isInternalTransfer: false,
        financialAccountId: 'acc1',
        financialAccount: { name: 'Caja General' },
      } as any,
      {
        id: '3',
        transactionDate: new Date(Date.UTC(2026, 7, 2, 9, 0, 0)), // 2 de Agosto
        type: 'EXPENSE',
        amount: 50 as any,
        paymentMethod: 'CASH',
        isInternalTransfer: false,
        financialAccountId: 'acc1',
        financialAccount: { name: 'Caja General' },
      } as any,
      {
        id: '4', // Movimiento Interno
        transactionDate: new Date(Date.UTC(2026, 7, 5, 10, 0, 0)),
        type: 'EXPENSE',
        amount: 1000 as any,
        paymentMethod: 'BANK_TRANSFER',
        isInternalTransfer: true,
        financialAccountId: 'acc1',
        financialAccount: { name: 'Caja General' },
        internalTransferSource: {
          destinationTransaction: { financialAccount: { name: 'Banco BNB' } }
        }
      } as any
    ]);

    const data = await service.getCashflowData({ year: 2026, month: 8 });

    expect(data.columns.incomes.length).toBe(2); // CASH y QR
    expect(data.columns.expenses.length).toBe(1); // CASH
    
    // Verificamos día 1
    const day1 = data.days[0]; // Índice 0 = 1 de Agosto
    expect(day1.dailyTotalIncome).toBe(500);
    expect(day1.dailyTotalExpense).toBe(0);
    expect(day1.dailyNetFlow).toBe(500);
    expect(day1.dailyAccumulatedBalance).toBe(500);

    // Verificamos día 2
    const day2 = data.days[1];
    expect(day2.dailyTotalIncome).toBe(0);
    expect(day2.dailyTotalExpense).toBe(50);
    expect(day2.dailyNetFlow).toBe(-50);
    expect(day2.dailyAccumulatedBalance).toBe(450); // 500 - 50

    // Verificamos totales
    expect(data.monthlyTotals.totalIncome).toBe(500);
    expect(data.monthlyTotals.totalExpense).toBe(50);
    expect(data.closingBalance).toBe(450);

    // Verificamos Internal Transfers (Hoja 3)
    expect(data.internalTransfers.length).toBe(1);
    expect(data.internalTransfers[0].amount).toBe(1000);
  });
});
