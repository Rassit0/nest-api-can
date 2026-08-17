import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, TransactionType, StatusCharge, CycleEnrollmentStatus } from '../generated/prisma/client';
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
            transaction: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: FinancialAccountsService,
          useValue: {
            applyMovement: jest.fn(),
          },
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
        transactionDate: new Date().toISOString(),
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
        transactionDate: new Date().toISOString(),
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
        transactionDate: new Date().toISOString(),
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
        transactionDate: new Date().toISOString(),
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

  describe('CycleEnrollment Sync (Pagos y Cancelaciones)', () => {
    let transactionCallbackPrisma: any;

    beforeEach(() => {
      // Mock para simular la ejecución del callback dentro de $transaction
      transactionCallbackPrisma = {
        charge: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        receiptSequence: {
          upsert: jest.fn().mockResolvedValue({ series: 'GEN', lastValue: 1 }),
        },
        payment: {
          create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          delete: jest.fn(),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
          findUnique: jest.fn().mockResolvedValue({ id: 'tx-1' }),
          count: jest.fn().mockResolvedValue(0),
          delete: jest.fn(),
        },
        attachment: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        cycleEnrollment: {
          updateMany: jest.fn(),
        },
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback(transactionCallbackPrisma);
      });
      jest.spyOn(prisma.financialAccount, 'findMany').mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta 1', allowedPaymentMethods: [PaymentMethod.CASH] } as any,
      ]);
    });

    it('Pago Completo: Charge -> PAID, CycleEnrollment -> CONFIRMED', async () => {
      transactionCallbackPrisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: { toNumber: () => 100 },
        pendingAmount: { toNumber: () => 100 },
        discountAmount: null,
        status: StatusCharge.PENDING,
      });

      const createDto: CreateTransactionDto = {
        amount: 100,
        paymentMethod: PaymentMethod.CASH,
        financialAccountId: 'acc-1',
        chargeId: 'charge-1',
        type: TransactionType.INCOME,
      } as any;

      await service.create(createDto);

      expect(transactionCallbackPrisma.charge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: StatusCharge.PAID, pendingAmount: 0 }),
        })
      );
      expect(transactionCallbackPrisma.cycleEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CONFIRMED' },
        })
      );
    });

    it('Pago Parcial: Charge -> PARTIAL, CycleEnrollment -> PENDING', async () => {
      transactionCallbackPrisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: { toNumber: () => 100 },
        pendingAmount: { toNumber: () => 100 },
        discountAmount: null,
        status: StatusCharge.PENDING,
      });

      const createDto: CreateTransactionDto = {
        amount: 50,
        paymentMethod: PaymentMethod.CASH,
        financialAccountId: 'acc-1',
        chargeId: 'charge-1',
        type: TransactionType.INCOME,
      } as any;

      await service.create(createDto);

      expect(transactionCallbackPrisma.charge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: StatusCharge.PARTIAL, pendingAmount: 50 }),
        })
      );
      expect(transactionCallbackPrisma.cycleEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PENDING' },
        })
      );
    });

    it('Cancelación de Pago Completo: Charge -> PENDING, CycleEnrollment -> PENDING', async () => {
      const mockTx = {
        id: 'tx-1',
        amount: { toNumber: () => 100 },
        paymentId: 'pay-1',
        payment: { chargeId: 'charge-1' },
      };
      
      // first call outside transaction
      jest.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(mockTx as any);

      // inside transaction
      transactionCallbackPrisma.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        amount: { toNumber: () => 100 },
        pendingAmount: { toNumber: () => 0 }, // It was PAID
        discountAmount: null,
        status: StatusCharge.PAID,
      });

      await service.remove('tx-1');

      expect(transactionCallbackPrisma.charge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: StatusCharge.PENDING, pendingAmount: 100 }),
        })
      );
      expect(transactionCallbackPrisma.cycleEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PENDING' },
        })
      );
    });
  });
});
