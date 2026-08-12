import { Test, TestingModule } from '@nestjs/testing';
import { PaymentReportService } from './payment-report.service';
import { PrinterService } from 'src/printer/printer.service';
import { PrismaService } from 'src/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';

describe('PaymentReportService', () => {
  let service: PaymentReportService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentReportService,
        {
          provide: PrinterService,
          useValue: {
            createPdf: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            payment: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn().mockReturnValue('Metodo'),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentReportService>(PaymentReportService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('getPaymentByIdReport (Fail-Safe check)', () => {
    // 1. Payment = 100 / Transaction = 100
    it('generates receipt when Payment amount equals single Transaction amount (100 = 100)', async () => {
      const mockPayment = {
        id: 'pay-1',
        amount: new Prisma.Decimal(100),
        paymentDate: new Date(),
        receiptNumber: 123,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal(100), paymentMethod: 'CASH' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      const result = await service.getPaymentByIdReport('pay-1');
      expect(result).toBeDefined();
    });

    // 2. Payment = 100 / Transactions = 50 + 50
    it('generates receipt when Payment amount equals sum of two Transactions (100 = 50 + 50)', async () => {
      const mockPayment = {
        id: 'pay-2',
        amount: new Prisma.Decimal(100),
        paymentDate: new Date(),
        receiptNumber: 124,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal(50), paymentMethod: 'CASH' },
          { id: 'tx-2', amount: new Prisma.Decimal(50), paymentMethod: 'QR' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      const result = await service.getPaymentByIdReport('pay-2');
      expect(result).toBeDefined();
    });

    // 3. Payment = 100 / Transactions = 25 + 25 + 50
    it('generates receipt when Payment amount equals sum of three Transactions (100 = 25 + 25 + 50)', async () => {
      const mockPayment = {
        id: 'pay-3',
        amount: new Prisma.Decimal(100),
        paymentDate: new Date(),
        receiptNumber: 125,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal(25), paymentMethod: 'CASH' },
          { id: 'tx-2', amount: new Prisma.Decimal(25), paymentMethod: 'TRANSFER' },
          { id: 'tx-3', amount: new Prisma.Decimal(50), paymentMethod: 'QR' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      const result = await service.getPaymentByIdReport('pay-3');
      expect(result).toBeDefined();
    });

    // 4. Payment = 100 / Transaction = 50 -> NO genera recibo
    it('throws InternalServerErrorException when Payment amount does not equal single Transaction amount (100 !== 50)', async () => {
      const mockPayment = {
        id: 'pay-4',
        amount: new Prisma.Decimal(100),
        paymentDate: new Date(),
        receiptNumber: 126,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal(50), paymentMethod: 'CASH' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      await expect(service.getPaymentByIdReport('pay-4')).rejects.toThrow(InternalServerErrorException);
    });

    // 5. Payment = 100 / Transactions = 30 + 30 -> NO genera recibo
    it('throws InternalServerErrorException when Payment amount does not equal sum of Transactions (100 !== 30 + 30)', async () => {
      const mockPayment = {
        id: 'pay-5',
        amount: new Prisma.Decimal(100),
        paymentDate: new Date(),
        receiptNumber: 127,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal(30), paymentMethod: 'CASH' },
          { id: 'tx-2', amount: new Prisma.Decimal(30), paymentMethod: 'QR' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      await expect(service.getPaymentByIdReport('pay-5')).rejects.toThrow(InternalServerErrorException);
    });

    // 6. Payment = 100 / Transactions = 100.00
    it('generates receipt and correctly compares Decimals without precision false positives (100 = 100.00)', async () => {
      const mockPayment = {
        id: 'pay-6',
        amount: new Prisma.Decimal('100'),
        paymentDate: new Date(),
        receiptNumber: 128,
        receiptSeries: 'A',
        transactions: [
          { id: 'tx-1', amount: new Prisma.Decimal('100.00'), paymentMethod: 'CASH' },
        ],
        charge: null,
      };

      jest.spyOn(prismaService.payment, 'findUnique').mockResolvedValue(mockPayment as any);
      const result = await service.getPaymentByIdReport('pay-6');
      expect(result).toBeDefined();
    });
  });
});
