import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, TransactionType } from '../generated/prisma/enums';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

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
            $transaction: jest.fn(),
          },
        },
        {
          provide: FinancialAccountsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create (allowedPaymentMethods validation)', () => {
    it('1. Cuenta permite CASH -> pago CASH exitoso', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta 1', allowedPaymentMethods: [PaymentMethod.CASH] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        financialAccountId: 'acc-1',
        reference: 'Test',
        transactionDate: new Date(),
        type: TransactionType.INCOME,
      };

      try {
        await service.create(createDto);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('2. Cuenta permite QR -> pago QR exitoso', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-2', name: 'Cuenta 2', allowedPaymentMethods: [PaymentMethod.QR] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        amount: 100,
        paymentMethod: PaymentMethod.QR,
        financialAccountId: 'acc-2',
        reference: 'Test',
        transactionDate: new Date(),
        type: TransactionType.INCOME,
      };

      try {
        await service.create(createDto);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('3. Cuenta permite QR pero se intenta CASH -> rechazado', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-2', name: 'Cuenta 2', allowedPaymentMethods: [PaymentMethod.QR] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        financialAccountId: 'acc-2',
        reference: 'Test',
        transactionDate: new Date(),
        type: TransactionType.INCOME,
      };

      await expect(service.create(createDto)).rejects.toThrow(
        new BadRequestException("La cuenta 'Cuenta 2' no permite pagos mediante CASH.")
      );
    });

    it('4. Cuenta con [] -> rechazado', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-3', name: 'Cuenta 3', allowedPaymentMethods: [] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        financialAccountId: 'acc-3',
        reference: 'Test',
        transactionDate: new Date(),
        type: TransactionType.INCOME,
      };

      await expect(service.create(createDto)).rejects.toThrow(
        new BadRequestException("La cuenta 'Cuenta 3' no está configurada y no puede recibir pagos.")
      );
    });

    it('5. Split con todos los métodos permitidos -> exitoso', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta 1', allowedPaymentMethods: [PaymentMethod.CASH] } as any,
        { id: 'acc-2', name: 'Cuenta 2', allowedPaymentMethods: [PaymentMethod.QR] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        chargeId: 'charge-1',
        splitTransactions: [
          { amount: 50, paymentMethod: PaymentMethod.CASH, financialAccountId: 'acc-1', reference: '' },
          { amount: 50, paymentMethod: PaymentMethod.QR, financialAccountId: 'acc-2', reference: '' },
        ],
      } as any;

      try {
        await service.create(createDto);
      } catch (e) {
        expect(e).not.toBeInstanceOf(BadRequestException);
      }
    });

    it('6. Split donde uno de los métodos no está permitido -> rechazado', async () => {
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta 1', allowedPaymentMethods: [PaymentMethod.CASH] } as any,
        { id: 'acc-2', name: 'Cuenta 2', allowedPaymentMethods: [PaymentMethod.QR] } as any,
      ]);

      const createDto: CreateTransactionDto = {
        chargeId: 'charge-1',
        splitTransactions: [
          { amount: 50, paymentMethod: PaymentMethod.CASH, financialAccountId: 'acc-1', reference: '' },
          // acc-2 only allows QR, we try TRANSFER
          { amount: 50, paymentMethod: PaymentMethod.TRANSFER, financialAccountId: 'acc-2', reference: '' },
        ],
      } as any;

      await expect(service.create(createDto)).rejects.toThrow(
        new BadRequestException("La cuenta 'Cuenta 2' no permite pagos mediante TRANSFER.")
      );
    });
  });
});
