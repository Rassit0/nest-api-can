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
  ): Promise<{ account: FinancialAccount; balanceBefore: number; balanceAfter: number }> {
    // 1. SELECT FOR UPDATE para bloquear la fila de la cuenta
    const lockedAccounts = (await tx.$queryRaw`
      SELECT id, cached_balance AS "cachedBalance", is_active AS "isActive"
      FROM financial_accounts
      WHERE id = ${financialAccountId}
      FOR UPDATE
    `) as { id: string; cachedBalance: Prisma.Decimal; isActive: boolean }[];

    if (!lockedAccounts || lockedAccounts.length === 0) {
      throw new NotFoundException(`Cuenta financiera con ID ${financialAccountId} no encontrada`);
    }

    const account = lockedAccounts[0];

    if (!account.isActive) {
      throw new Error(`La cuenta financiera se encuentra inactiva.`);
    }

    const numericAmount = typeof amount === 'number' ? amount : amount.toNumber();

    // Calcular el saldo individual para actualizar internamente
    const individualBalanceBefore = Number(account.cachedBalance);
    const individualBalanceAfter =
      type === TransactionType.INCOME
        ? individualBalanceBefore + numericAmount
        : individualBalanceBefore - numericAmount;

    const updatedAccount = await tx.financialAccount.update({
      where: { id: financialAccountId },
      data: {
        cachedBalance: individualBalanceAfter,
      },
    });

    return {
      account: updatedAccount,
      balanceBefore: individualBalanceBefore,
      balanceAfter: individualBalanceAfter,
    };
  }

  /**
   * Recalcula la cadena histórica de snapshots de balances (balanceBefore, balanceAfter)
   * para una cuenta en orden Ledger (transactionDate ASC, createdAt ASC, id ASC).
   * Debe llamarse dentro de la misma transacción DB cuando se inserta una
   * transacción backdated, o se cancela una operación.
   */
  async recalculateAccountSnapshots(
    financialAccountId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`
      WITH ordered AS (
        SELECT 
          id,
          amount,
          type,
          status,
          ROW_NUMBER() OVER (ORDER BY transaction_date ASC, created_at ASC, id ASC) as rn
        FROM transactions
        WHERE financial_account_id = ${financialAccountId}
      ),
      running AS (
        SELECT 
          id,
          COALESCE(
            SUM(CASE WHEN status = 'COMPLETED' THEN (CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) ELSE 0 END) 
            OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 
            0
          ) as calc_before,
          SUM(CASE WHEN status = 'COMPLETED' THEN (CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) ELSE 0 END) 
          OVER (ORDER BY rn ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as calc_after
        FROM ordered
      )
      UPDATE transactions t
      SET 
        balance_before = r.calc_before,
        balance_after = r.calc_after
      FROM running r
      WHERE t.id = r.id
        AND (t.balance_before IS DISTINCT FROM r.calc_before OR t.balance_after IS DISTINCT FROM r.calc_after);
    `;
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

  async findOptions() {
    return this.prisma.financialAccount.findMany({
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
        const movement = await this.applyMovement(account.id, initialBalance, TransactionType.INCOME, tx);

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
            balanceBefore: movement.balanceBefore,
            balanceAfter: movement.balanceAfter,
          },
        });

        account.cachedBalance = new Prisma.Decimal(movement.balanceAfter);
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
