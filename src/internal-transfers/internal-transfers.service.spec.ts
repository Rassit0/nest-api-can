import { Test, TestingModule } from '@nestjs/testing';
import { InternalTransfersService } from './internal-transfers.service';
import { PrismaService } from '../prisma.service';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { ReceiptResolverService } from '../payments/receipt-resolver.service';
import { PrinterService } from '../printer/printer.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

describe('InternalTransfersService', () => {
  let service: InternalTransfersService;
  let prisma: PrismaService;

  const mockPrisma = {
    $transaction: jest.fn(),
  };

  const mockFinancialAccountsService = {
    applyMovement: jest.fn(),
    recalculateAccountSnapshots: jest.fn(),
  };

  const mockReceiptResolver = {
    nextReceiptNumber: jest.fn().mockResolvedValue(1),
  };

  const mockPrinter = {
    renderPdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalTransfersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: FinancialAccountsService,
          useValue: mockFinancialAccountsService,
        },
        {
          provide: ReceiptResolverService,
          useValue: mockReceiptResolver,
        },
        {
          provide: PrinterService,
          useValue: mockPrinter,
        },
      ],
    }).compile();

    service = module.get<InternalTransfersService>(InternalTransfersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('debe rechazar la transferencia si la cuenta de origen está inactiva', async () => {
      const txMock = {
        financialAccount: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'src-inactive') {
              return Promise.resolve({
                id: 'src-inactive',
                name: 'Caja Inactiva',
                isActive: false,
                cachedBalance: new Prisma.Decimal(1000),
              });
            }
            return Promise.resolve({
              id: 'dst-active',
              name: 'Banco Activo',
              isActive: true,
              cachedBalance: new Prisma.Decimal(500),
            });
          }),
        },
      };

      mockPrisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.create(
          {
            amount: 100,
            sourceAccountId: 'src-inactive',
            destinationAccountId: 'dst-active',
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(new BadRequestException('La cuenta de origen está inactiva'));
    });

    it('debe rechazar la transferencia si la cuenta de destino está inactiva', async () => {
      const txMock = {
        financialAccount: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'src-active') {
              return Promise.resolve({
                id: 'src-active',
                name: 'Caja Activa',
                isActive: true,
                cachedBalance: new Prisma.Decimal(1000),
              });
            }
            return Promise.resolve({
              id: 'dst-inactive',
              name: 'Banco Inactivo',
              isActive: false,
              cachedBalance: new Prisma.Decimal(500),
            });
          }),
        },
      };

      mockPrisma.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.create(
          {
            amount: 100,
            sourceAccountId: 'src-active',
            destinationAccountId: 'dst-inactive',
          },
          { id: 'user-1' },
        ),
      ).rejects.toThrow(new BadRequestException('La cuenta de destino está inactiva'));
    });
  });
});
