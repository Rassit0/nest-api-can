import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAccountsService } from './financial-accounts.service';
import { PrismaService } from '../prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType, FinancialAccountType, Prisma } from '../generated/prisma/client';

describe('FinancialAccountsService', () => {
  let service: FinancialAccountsService;
  let prisma: PrismaService;

  const mockPrisma = {
    financialAccount: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    transaction: {
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAccountsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<FinancialAccountsService>(FinancialAccountsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('applyMovement', () => {
    const txMock = {
      $queryRaw: jest.fn(),
      financialAccount: {
        update: jest.fn(),
      },
    } as any;

    it('debe lanzar NotFoundException si la cuenta no existe en DB', async () => {
      txMock.$queryRaw.mockResolvedValue([]);

      await expect(
        service.applyMovement('acc-not-found', 100, TransactionType.INCOME, txMock),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si la cuenta está inactiva y allowInactive=false', async () => {
      txMock.$queryRaw.mockResolvedValue([
        {
          id: 'acc-inactive',
          name: 'Caja Inactiva',
          cachedBalance: new Prisma.Decimal(500),
          isActive: false,
        },
      ]);

      await expect(
        service.applyMovement('acc-inactive', 100, TransactionType.INCOME, txMock, false),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.applyMovement('acc-inactive', 100, TransactionType.INCOME, txMock, false),
      ).rejects.toThrow("La cuenta financiera 'Caja Inactiva' se encuentra inactiva.");
    });

    it('debe permitir movimiento si la cuenta está inactiva pero allowInactive=true (reversión)', async () => {
      txMock.$queryRaw.mockResolvedValue([
        {
          id: 'acc-inactive',
          name: 'Caja Inactiva',
          cachedBalance: new Prisma.Decimal(500),
          isActive: false,
        },
      ]);

      txMock.financialAccount.update.mockResolvedValue({
        id: 'acc-inactive',
        name: 'Caja Inactiva',
        cachedBalance: new Prisma.Decimal(400),
        isActive: false,
      });

      const result = await service.applyMovement(
        'acc-inactive',
        100,
        TransactionType.EXPENSE,
        txMock,
        true, // allowInactive
      );

      expect(result.balanceBefore).toBe(500);
      expect(result.balanceAfter).toBe(400);
      expect(txMock.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-inactive' },
        data: { cachedBalance: 400 },
      });
    });

    it('debe aplicar movimiento exitosamente en cuenta activa', async () => {
      txMock.$queryRaw.mockResolvedValue([
        {
          id: 'acc-active',
          name: 'Caja Principal',
          cachedBalance: new Prisma.Decimal(1000),
          isActive: true,
        },
      ]);

      txMock.financialAccount.update.mockResolvedValue({
        id: 'acc-active',
        name: 'Caja Principal',
        cachedBalance: new Prisma.Decimal(1250),
        isActive: true,
      });

      const result = await service.applyMovement(
        'acc-active',
        250,
        TransactionType.INCOME,
        txMock,
      );

      expect(result.balanceBefore).toBe(1000);
      expect(result.balanceAfter).toBe(1250);
      expect(txMock.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-active' },
        data: { cachedBalance: 1250 },
      });
    });
  });

  describe('findOptions', () => {
    it('debe filtrar exclusivamente cuentas activas (where: { isActive: true })', async () => {
      mockPrisma.financialAccount.findMany.mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta Activa', isActive: true },
      ]);

      await service.findOptions();

      expect(mockPrisma.financialAccount.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          currency: true,
          type: true,
          isDefault: true,
          allowedPaymentMethods: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findAll', () => {
    it('debe retornar todas las cuentas sin filtrar por isActive (para auditoría y admin)', async () => {
      mockPrisma.financialAccount.findMany.mockResolvedValue([
        { id: 'acc-1', name: 'Cuenta Activa', isActive: true },
        { id: 'acc-2', name: 'Cuenta Inactiva', isActive: false },
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(mockPrisma.financialAccount.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('update (inactivación y reactivación)', () => {
    it('debe permitir inactivar una cuenta (isActive: false) sin alterar su saldo ni snapshots', async () => {
      mockPrisma.financialAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        name: 'Cuenta Principal',
        isActive: true,
        cachedBalance: new Prisma.Decimal(5000),
      });

      mockPrisma.financialAccount.update.mockResolvedValue({
        id: 'acc-1',
        name: 'Cuenta Principal',
        isActive: false,
        cachedBalance: new Prisma.Decimal(5000),
      });

      const result = await service.update('acc-1', { isActive: false });

      expect(result.isActive).toBe(false);
      expect(mockPrisma.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          isActive: false,
          isDefault: undefined,
        },
      });
    });

    it('debe permitir reactivar una cuenta previamente inactivada (isActive: true)', async () => {
      mockPrisma.financialAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        name: 'Cuenta Principal',
        isActive: false,
        cachedBalance: new Prisma.Decimal(5000),
      });

      mockPrisma.financialAccount.update.mockResolvedValue({
        id: 'acc-1',
        name: 'Cuenta Principal',
        isActive: true,
        cachedBalance: new Prisma.Decimal(5000),
      });

      const result = await service.update('acc-1', { isActive: true });

      expect(result.isActive).toBe(true);
      expect(mockPrisma.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: {
          isActive: true,
          isDefault: undefined,
        },
      });
    });

    it('debe lanzar NotFoundException si la cuenta a actualizar no existe', async () => {
      mockPrisma.financialAccount.findUnique.mockResolvedValue(null);

      await expect(service.update('acc-404', { isActive: false })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
