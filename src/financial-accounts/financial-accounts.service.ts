import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccount, Prisma, TransactionType } from 'src/generated/prisma/client';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';

@Injectable()
export class FinancialAccountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Actualiza el saldo operativo de una cuenta financiera.
   * IMPORTANTE: Este método siempre debe llamarse dentro de una transacción de Prisma ($transaction)
   * para asegurar la integridad atómica.
   */
  async applyMovement(
    financialAccountId: string,
    amount: number | Prisma.Decimal,
    type: TransactionType,
    tx: Prisma.TransactionClient,
  ): Promise<FinancialAccount> {
    const account = await tx.financialAccount.findUnique({
      where: { id: financialAccountId },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta financiera con ID ${financialAccountId} no encontrada`);
    }

    if (!account.isActive) {
      throw new Error(`La cuenta financiera ${account.name} se encuentra inactiva.`);
    }

    const numericAmount = typeof amount === 'number' ? amount : amount.toNumber();

    return tx.financialAccount.update({
      where: { id: financialAccountId },
      data: {
        cachedBalance: {
          [type === TransactionType.INCOME ? 'increment' : 'decrement']: numericAmount,
        },
      },
    });
  }

  /**
   * Recalcula el saldo de la cuenta desde cero basado en el historial inmutable de transacciones.
   * Utilizado para arqueos, cierres o resolución de inconsistencias.
   */
  async recalculateBalance(accountId: string): Promise<FinancialAccount> {
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta financiera no encontrada`);
    }

    const aggregations = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: {
        financialAccountId: accountId,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    for (const agg of aggregations) {
      if (agg.type === TransactionType.INCOME) {
        totalIncome = agg._sum.amount?.toNumber() || 0;
      } else if (agg.type === TransactionType.EXPENSE) {
        totalExpense = agg._sum.amount?.toNumber() || 0;
      }
    }

    const newBalance = totalIncome - totalExpense;

    return this.prisma.financialAccount.update({
      where: { id: accountId },
      data: { cachedBalance: newBalance },
    });
  }

  async findAll() {
    return this.prisma.financialAccount.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(createDto: CreateFinancialAccountDto) {
    const { initialBalance, isDefault, ...data } = createDto;

    return this.prisma.$transaction(async (tx) => {
      // Si la nueva cuenta es por defecto, quitar el flag a las demás
      if (isDefault) {
        await tx.financialAccount.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      // Crear la cuenta
      const account = await tx.financialAccount.create({
        data: {
          ...data,
          isDefault,
          cachedBalance: 0,
        },
      });

      // Si hay saldo inicial, crear el asiento de apertura
      if (initialBalance && initialBalance > 0) {
        await tx.transaction.create({
          data: {
            amount: initialBalance,
            type: TransactionType.INCOME,
            transactionDate: new Date(),
            reference: 'OPENING_BALANCE',
            status: 'COMPLETED',
            financialAccount: { connect: { id: account.id } },
            paymentMethod: 'CASH',
            receiptSeries: 'OPBAL',
            receiptNumber: Math.floor(Date.now() % 1000000000),
            // Asumiendo que hay una descripción o similar opcional, 
            // de lo contrario, transaction no requiere descripción en este contexto básico.
          },
        });

        // Actualizar el cachedBalance con el saldo inicial
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { cachedBalance: initialBalance },
        });
        
        account.cachedBalance = new Prisma.Decimal(initialBalance);
      }

      return account;
    });
  }

  async update(id: string, updateDto: UpdateFinancialAccountDto) {
    // initialBalance se ignora en actualizaciones por inmutabilidad del Ledger
    const { initialBalance, isDefault, ...data } = updateDto;

    const account = await this.prisma.financialAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Cuenta financiera no encontrada`);
    }

    if (isDefault) {
      await this.prisma.financialAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        ...data,
        isDefault,
      },
    });
  }
}
