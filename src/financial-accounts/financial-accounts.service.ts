import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccount, Prisma, TransactionType } from 'src/generated/prisma/client';

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

    const newBalance = Number(account.initialBalance) + totalIncome - totalExpense;

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
}
