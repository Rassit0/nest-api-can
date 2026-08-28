import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsService } from 'src/financial-accounts/financial-accounts.service';
import { Prisma } from 'src/generated/prisma/client';
import { NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;
  let financialAccountsService: FinancialAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
            charge: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              update: jest.fn(),
            },
            cycleEnrollment: {
              findMany: jest.fn().mockResolvedValue([]),
              updateMany: jest.fn(),
            },
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

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    financialAccountsService = module.get<FinancialAccountsService>(
      FinancialAccountsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated payments filtered by chargeId', async () => {
      const chargeId = 'charge-1';
      const mockPayments = [
        { id: '1', amount: new Prisma.Decimal(100), transactions: [] },
      ];
      jest.spyOn(prisma.payment, 'findMany').mockResolvedValue(mockPayments as any);
      jest.spyOn(prisma.payment, 'count').mockResolvedValue(1);

      const result = await service.findAll({ chargeId });
      expect(result.data).toHaveLength(1);
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { chargeId } }),
      );
    });
  });

  describe('removePayment', () => {
    const mockCharge = {
      id: 'charge-1',
      amount: new Prisma.Decimal(1000),
      pendingAmount: new Prisma.Decimal(900),
      adjustmentAmount: new Prisma.Decimal(0),
      status: 'PARTIAL',
    };

    it('should throw NotFoundException if payment not found', async () => {
      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(null);
      await expect(service.removePayment('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Caso C — Segundo intento de anulación (Debe lanzar BadRequestException si ya está CANCELLED)', async () => {
      const mockPayment = {
        id: 'payment-cancelled',
        amount: new Prisma.Decimal(100),
        status: 'CANCELLED',
        transactions: [],
        charge: mockCharge,
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      await expect(service.removePayment('payment-cancelled')).rejects.toThrow(
        BadRequestException,
      );
      // No debería haber llamado a ningún update
      expect(prisma.charge.update).not.toHaveBeenCalled();
      expect(financialAccountsService.applyMovement).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if Fail-Safe mathematical validation fails', async () => {
      const mockPayment = {
        id: 'payment-1',
        amount: new Prisma.Decimal(100),
        status: 'COMPLETED',
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(50) },
        ], // Suma 50, el payment es 100
        charge: mockCharge,
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);

      await expect(service.removePayment('payment-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('Caso A & B — Anulación exitosa y comprobante conservado', async () => {
      const mockPayment = {
        id: 'payment-1',
        receiptSeries: 'EQP',
        receiptNumber: 45,
        status: 'COMPLETED',
        amount: new Prisma.Decimal(100),
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(100), financialAccountId: 'acc-1', type: 'INCOME', status: 'COMPLETED' },
        ],
        charge: mockCharge, // pending 900
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      jest.spyOn(prisma.charge, 'update').mockResolvedValue(mockCharge as any);
      jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.payment, 'update').mockResolvedValue({ id: 'payment-1', status: 'CANCELLED' } as any);

      await service.removePayment('payment-1');

      // 1. Check pendingAmount increased by 100 -> new pending is 1000
      expect(prisma.charge.update).toHaveBeenCalledWith({
        where: { id: mockCharge.id },
        data: { pendingAmount: 1000, status: 'PENDING' },
      });

      // 2. Check applyMovement called to revert financial account (-100)
      expect(financialAccountsService.applyMovement).toHaveBeenCalledWith(
        'acc-1',
        -100,
        'INCOME',
        prisma,
      );

      // 3. Check transaction and payment updated to CANCELLED (Soft delete)
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should successfully void a Split Payment', async () => {
      const mockPayment = {
        id: 'split-payment',
        amount: new Prisma.Decimal(100),
        status: 'COMPLETED',
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(50), financialAccountId: 'cash-acc', type: 'INCOME', status: 'COMPLETED' },
          { id: 't2', amount: new Prisma.Decimal(50), financialAccountId: 'bank-acc', type: 'INCOME', status: 'COMPLETED' },
        ],
        charge: mockCharge, // pending 900
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      jest.spyOn(prisma.charge, 'update').mockResolvedValue(mockCharge as any);
      jest.spyOn(prisma.transaction, 'update').mockResolvedValue({} as any);
      jest.spyOn(prisma.payment, 'update').mockResolvedValue({} as any);

      await service.removePayment('split-payment');

      // The charge should revert 100 exactly ONCE
      expect(prisma.charge.update).toHaveBeenCalledWith({
        where: { id: mockCharge.id },
        data: { pendingAmount: 1000, status: 'PENDING' },
      });

      // Apply movement should be called TWICE (-50 and -50)
      expect(financialAccountsService.applyMovement).toHaveBeenCalledTimes(2);
      expect(financialAccountsService.applyMovement).toHaveBeenNthCalledWith(1, 'cash-acc', -50, 'INCOME', prisma);
      expect(financialAccountsService.applyMovement).toHaveBeenNthCalledWith(2, 'bank-acc', -50, 'INCOME', prisma);

      // Transactions updated TWICE
      expect(prisma.transaction.update).toHaveBeenCalledTimes(2);
    });

    it('Caso F — Pago parcial', async () => {
      const chargeForPartial = {
        id: 'charge-partial',
        amount: new Prisma.Decimal(1000),
        pendingAmount: new Prisma.Decimal(400),
        adjustmentAmount: new Prisma.Decimal(0),
        status: 'PARTIAL',
      };

      const mockPaymentA = {
        id: 'payment-A',
        amount: new Prisma.Decimal(400),
        status: 'COMPLETED',
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(200), financialAccountId: 'cash-acc', type: 'INCOME', status: 'COMPLETED' },
          { id: 't2', amount: new Prisma.Decimal(200), financialAccountId: 'qr-acc', type: 'INCOME', status: 'COMPLETED' },
        ],
        charge: chargeForPartial, // pending 400
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPaymentA as any);
      jest.spyOn(prisma.charge, 'update').mockResolvedValue(chargeForPartial as any);

      await service.removePayment('payment-A');

      // The charge should revert 400 (leaving 800 pending, status PARTIAL)
      expect(prisma.charge.update).toHaveBeenCalledWith({
        where: { id: chargeForPartial.id },
        data: { pendingAmount: 800, status: 'PARTIAL' },
      });

      // Two financial reverts
      expect(financialAccountsService.applyMovement).toHaveBeenNthCalledWith(1, 'cash-acc', -200, 'INCOME', prisma);
      expect(financialAccountsService.applyMovement).toHaveBeenNthCalledWith(2, 'qr-acc', -200, 'INCOME', prisma);
    });

    it('Caso D — Restauración del saldo con Descuento (adjustmentAmount negativo)', async () => {
      // Caso D: amount = 500, adjustmentAmount = -50, expectedTotal = 450
      const chargeDescuento = {
        id: 'charge-desc',
        amount: new Prisma.Decimal(500),
        pendingAmount: new Prisma.Decimal(0),
        adjustmentAmount: new Prisma.Decimal(-50), // Descuento
        status: 'PAID',
      };

      const mockPayment = {
        id: 'payment-desc',
        amount: new Prisma.Decimal(450), // Se pagó 450 (500 - 50)
        status: 'COMPLETED',
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(450), financialAccountId: 'acc-1', type: 'INCOME', status: 'COMPLETED' },
        ],
        charge: chargeDescuento, 
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      jest.spyOn(prisma.charge, 'update').mockResolvedValue(chargeDescuento as any);

      await service.removePayment('payment-desc');

      // The charge should revert pending to 450 and status to PENDING
      expect(prisma.charge.update).toHaveBeenCalledWith({
        where: { id: chargeDescuento.id },
        data: { pendingAmount: 450, status: 'PENDING' },
      });
    });

    it('Caso E — Restauración del saldo con Recargo (adjustmentAmount positivo)', async () => {
      // Caso E: amount = 500, adjustmentAmount = 50, expectedTotal = 550
      const chargeRecargo = {
        id: 'charge-rec',
        amount: new Prisma.Decimal(500),
        pendingAmount: new Prisma.Decimal(0),
        adjustmentAmount: new Prisma.Decimal(50), // Recargo
        status: 'PAID',
      };

      const mockPayment = {
        id: 'payment-rec',
        amount: new Prisma.Decimal(550), // Se pagó 550 (500 + 50)
        status: 'COMPLETED',
        transactions: [
          { id: 't1', amount: new Prisma.Decimal(550), financialAccountId: 'acc-1', type: 'INCOME', status: 'COMPLETED' },
        ],
        charge: chargeRecargo, 
      };

      jest.spyOn(prisma.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      jest.spyOn(prisma.charge, 'update').mockResolvedValue(chargeRecargo as any);

      await service.removePayment('payment-rec');

      // The charge should revert pending to 550 and status to PENDING
      expect(prisma.charge.update).toHaveBeenCalledWith({
        where: { id: chargeRecargo.id },
        data: { pendingAmount: 550, status: 'PENDING' },
      });
    });
  });
});
