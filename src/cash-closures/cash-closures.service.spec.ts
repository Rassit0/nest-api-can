import { Test, TestingModule } from '@nestjs/testing';
import { CashClosuresService } from './cash-closures.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

describe('CashClosuresService', () => {
  let service: CashClosuresService;
  let prisma: PrismaService;

  const mockPrisma = {
    financialAccount: {
      findUnique: jest.fn(),
    },
    cashClosure: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashClosuresService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CashClosuresService>(CashClosuresService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe rechazar un arqueo de caja si la cuenta está inactiva', async () => {
      mockPrisma.financialAccount.findUnique.mockResolvedValue({
        id: 'cash-1',
        name: 'Caja Chica Inactiva',
        type: 'CASH',
        isActive: false,
        cachedBalance: new Prisma.Decimal(200),
      });

      await expect(
        service.create(
          {
            financialAccountId: 'cash-1',
            actualBalance: 200,
          },
          'user-1',
        ),
      ).rejects.toThrow(new BadRequestException('La cuenta financiera se encuentra inactiva.'));
    });

    it('debe crear el arqueo de caja exitosamente si la cuenta es CASH y está activa', async () => {
      mockPrisma.financialAccount.findUnique.mockResolvedValue({
        id: 'cash-1',
        name: 'Caja Chica Activa',
        type: 'CASH',
        isActive: true,
        cachedBalance: new Prisma.Decimal(200),
      });

      mockPrisma.cashClosure.create.mockResolvedValue({
        id: 'closure-1',
        financialAccountId: 'cash-1',
        expectedBalance: new Prisma.Decimal(200),
        actualBalance: new Prisma.Decimal(200),
        difference: new Prisma.Decimal(0),
        createdById: 'user-1',
      });

      const result = await service.create(
        {
          financialAccountId: 'cash-1',
          actualBalance: 200,
        },
        'user-1',
      );

      expect(result.id).toBe('closure-1');
      expect(mockPrisma.cashClosure.create).toHaveBeenCalled();
    });
  });
});
