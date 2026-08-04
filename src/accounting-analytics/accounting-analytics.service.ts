import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType, Prisma } from 'src/generated/prisma/client';

export interface AnalyticsPeriodParams {
  start?: string;
  end?: string;
}

@Injectable()
export class AccountingAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determina las fechas de inicio y fin para el periodo analítico
   */
  getPeriodDates(params?: AnalyticsPeriodParams): { periodStart: Date; periodEnd: Date } {
    const today = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (params?.start && params?.end) {
      periodStart = new Date(`${params.start}T00:00:00`);
      periodEnd = new Date(`${params.end}T23:59:59.999`);
    } else {
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { periodStart, periodEnd };
  }

  /**
   * Obtiene métricas de deuda (Cuentas por cobrar y pagar) globales
   */
  async getDebtMetrics() {
    const pendingStatuses = [StatusCharge.PENDING, StatusCharge.PARTIAL];
    const [accountReceivables, membershipReceivables, payables] = await Promise.all([
      this.prisma.charge.aggregate({
        where: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, accountCharge: { isNot: null } },
        _sum: { pendingAmount: true },
      }),
      this.prisma.charge.aggregate({
        where: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, membershipCharges: { some: {} } },
        _sum: { pendingAmount: true },
      }),
      this.prisma.charge.aggregate({
        where: { direction: 'PAYABLE', status: { in: pendingStatuses } },
        _sum: { pendingAmount: true },
      }),
    ]);

    return {
      totalAccountReceivables: Number(accountReceivables._sum.pendingAmount || 0),
      totalMembershipReceivables: Number(membershipReceivables._sum.pendingAmount || 0),
      totalPayables: Number(payables._sum.pendingAmount || 0),
    };
  }

  /**
   * Encapsula la lógica de cálculo de liquidez actual
   */
  async getLiquidityMetrics() {
    const accounts = await this.prisma.financialAccount.groupBy({
      by: ['type'],
      where: {
        isActive: true,
        currency: 'BOB', // TODO: Soporte multimoneda en el futuro
      },
      _sum: {
        cachedBalance: true,
      }
    });

    let totalInCash = 0;
    let totalInBanks = 0;

    for (const acc of accounts) {
      const balance = acc._sum.cachedBalance?.toNumber() || 0;
      if (acc.type === 'CASH') {
        totalInCash += balance;
      } else if (acc.type === 'BANK' || acc.type === 'DIGITAL_WALLET') {
        totalInBanks += balance;
      }
    }

    return {
      totalInCash,
      totalInBanks,
      totalLiquidity: totalInCash + totalInBanks,
    };
  }

  /**
   * Obtiene todos los flujos de dinero pagados (Income/Expense) en un periodo
   */
  async getPeriodTransactions(periodStart: Date, periodEnd: Date) {
    return this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: periodStart, lte: periodEnd },
        isInternalTransfer: false, // EXCLUIR TRANSFERENCIAS
        status: { in: ['COMPLETED'] } // O lo que aplique, asumo que todas están completadas
      },
      select: {
        id: true,
        amount: true,
        type: true,
        transactionDate: true,
        receiptSeries: true,
        receiptNumber: true,
        paymentMethod: true,
        chargeTransactions: {
          select: {
            charge: {
              select: {
                studentCharges: { select: { id: true } },
                membershipCharges: { select: { id: true } },
                accountCharge: { select: { id: true, category: { select: { name: true } } } }
              }
            }
          }
        }
      }
    });
  }

  /**
   * Obtiene el resumen de ingresos y egresos de un periodo
   */
  async getPeriodTotals(periodStart: Date, periodEnd: Date) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: periodStart, lte: periodEnd },
        isInternalTransfer: false,
      },
      select: {
        amount: true,
        type: true,
      }
    });

    let periodIncome = 0;
    let periodExpenses = 0;

    transactions.forEach(t => {
      const amount = Number(t.amount);
      if (t.type === TransactionType.INCOME) {
        periodIncome += amount;
      } else if (t.type === TransactionType.EXPENSE) {
        periodExpenses += amount;
      }
    });

    return { periodIncome, periodExpenses };
  }
}
