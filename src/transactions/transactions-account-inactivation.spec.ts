import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, TransactionType } from '../generated/prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ReceiptResolverService } from '../payments/receipt-resolver.service';
import { PaymentsService } from '../payments/payments.service';

describe('TransactionsService - Financial Account Inactivation Enforcement', () => {
  let service: TransactionsService;
  let prisma: PrismaService;
  let financialAccountsService: FinancialAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            financialAccount: {
              findMany: jest.fn(),
            },
            transaction: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: FinancialAccountsService,
          useValue: {
            applyMovement: jest.fn().mockResolvedValue({
              account: { id: 'acc-1' },
              balanceBefore: 100,
              balanceAfter: 200,
            }),
            recalculateAccountSnapshots: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReceiptResolverService,
          useValue: {
            nextReceiptNumber: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            removePayment: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
    financialAccountsService = module.get<FinancialAccountsService>(FinancialAccountsService);
  });

  it('debe rechazar la creación de una transacción de INGRESO si la cuenta financiera está inactiva', async () => {
    jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
      {
        id: 'acc-inactive',
        name: 'Caja Secundaria Inactiva',
        allowedPaymentMethods: [PaymentMethod.CASH],
        isActive: false,
      } as any,
    ]);

    const dto: CreateTransactionDto = {
      amount: 150,
      paymentMethod: PaymentMethod.CASH,
      financialAccountId: 'acc-inactive',
      reference: 'Manual Ref',
      transactionDate: new Date().toISOString(),
      type: TransactionType.INCOME,
    };

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    await expect(service.create(dto)).rejects.toThrow(
      "La cuenta financiera 'Caja Secundaria Inactiva' se encuentra inactiva y no puede recibir operaciones.",
    );
  });

  it('debe rechazar la creación de una transacción de EGRESO si la cuenta financiera está inactiva', async () => {
    jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
      {
        id: 'acc-inactive',
        name: 'Banco Inactivo',
        allowedPaymentMethods: [PaymentMethod.TRANSFER],
        isActive: false,
      } as any,
    ]);

    const dto: CreateTransactionDto = {
      amount: 80,
      paymentMethod: PaymentMethod.TRANSFER,
      financialAccountId: 'acc-inactive',
      reference: 'Pago Servicio',
      transactionDate: new Date().toISOString(),
      type: TransactionType.EXPENSE,
    };

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    await expect(service.create(dto)).rejects.toThrow(
      "La cuenta financiera 'Banco Inactivo' se encuentra inactiva y no puede recibir operaciones.",
    );
  });

  it('debe rechazar un pago combinado/split si al menos una de las cuentas está inactiva', async () => {
    jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
      {
        id: 'acc-active',
        name: 'Caja Activa',
        allowedPaymentMethods: [PaymentMethod.CASH],
        isActive: true,
      } as any,
      {
        id: 'acc-inactive',
        name: 'Banco Inactivo',
        allowedPaymentMethods: [PaymentMethod.TRANSFER],
        isActive: false,
      } as any,
    ]);

    const dto: CreateTransactionDto = {
      chargeId: 'charge-1',
      amount: 200,
      type: TransactionType.INCOME,
      splitTransactions: [
        {
          amount: 100,
          paymentMethod: PaymentMethod.CASH,
          financialAccountId: 'acc-active',
          reference: '',
        },
        {
          amount: 100,
          paymentMethod: PaymentMethod.TRANSFER,
          financialAccountId: 'acc-inactive',
          reference: '',
        },
      ],
    } as any;

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    await expect(service.create(dto)).rejects.toThrow(
      "La cuenta financiera 'Banco Inactivo' se encuentra inactiva y no puede recibir operaciones.",
    );
  });

  it('debe permitir anulación/reversión de una transacción histórica en cuenta inactiva pasando allowInactive=true', async () => {
    const historicalTx = {
      id: 'tx-historical',
      amount: 100,
      type: TransactionType.INCOME,
      status: 'COMPLETED',
      financialAccountId: 'acc-inactive',
      isInternalTransfer: false,
      paymentId: null,
    };

    jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(historicalTx as any);

    const txMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'tx-historical', status: 'COMPLETED' }]),
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ ...historicalTx, status: 'CANCELLED' }),
      },
    };

    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

    await service.remove('tx-historical');

    expect(financialAccountsService.applyMovement).toHaveBeenCalledWith(
      'acc-inactive',
      100,
      'EXPENSE',
      txMock,
      true, // allowInactive
    );
  });
});
