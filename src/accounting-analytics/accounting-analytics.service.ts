import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType, TransactionStatus, TransferStatus } from 'src/generated/prisma/client';

export interface AnalyticsPeriodParams {
  start?: string;
  end?: string;
}

@Injectable()
export class AccountingAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  getPeriodDates(params?: AnalyticsPeriodParams): { periodStart: Date; periodEnd: Date } {
    const today = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (params?.start && params?.end) {
      periodStart = new Date(params.start);
      periodEnd = new Date(params.end);
      periodEnd.setUTCHours(23, 59, 59, 999);
    } else {
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    return { periodStart, periodEnd };
  }

  async getTreasuryMetrics() {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        isActive: true,
        cachedBalance: true,
      },
      orderBy: { name: 'asc' },
    });

    const liquidityByCurrency: Record<string, number> = {};
    const formattedAccounts = accounts.map(acc => {
      const balance = acc.cachedBalance?.toNumber() || 0;
      const cur = acc.currency || 'BOB';
      if (!liquidityByCurrency[cur]) liquidityByCurrency[cur] = 0;
      liquidityByCurrency[cur] += balance;
      return { ...acc, balance };
    });

    return {
      liquidityByCurrency,
      accounts: formattedAccounts,
    };
  }

  async getReceivableMetrics() {
    const today = new Date();
    
    const charges = await this.prisma.charge.findMany({
      where: {
        direction: 'RECEIVABLE',
        status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
      },
      select: {
        pendingAmount: true,
        dueDate: true,
        accountCharge: { select: { id: true } },
        studentCharges: { select: { id: true } },
        membershipCharges: { select: { id: true } },
      }
    });

    const metrics = {
      expired: { total: 0, student: 0, membership: 0, general: 0 },
      valid: { total: 0, student: 0, membership: 0, general: 0 },
      total: 0,
    };

    charges.forEach(c => {
      const amount = Number(c.pendingAmount || 0);
      const isExpired = c.dueDate < today;
      const target = isExpired ? metrics.expired : metrics.valid;
      
      target.total += amount;
      metrics.total += amount;

      if (c.studentCharges.length > 0) target.student += amount;
      else if (c.membershipCharges.length > 0) target.membership += amount;
      else target.general += amount;
    });

    return { receivables: metrics };
  }

  async getPayableMetrics() {
    const today = new Date();
    const charges = await this.prisma.charge.findMany({
      where: {
        direction: 'PAYABLE',
        status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
      },
      select: {
        pendingAmount: true,
        dueDate: true,
      }
    });

    let expired = 0;
    let valid = 0;

    charges.forEach(c => {
      const amount = Number(c.pendingAmount || 0);
      if (c.dueDate < today) expired += amount;
      else valid += amount;
    });

    return { 
      payables: { expired, valid, total: expired + valid }
    };
  }

  async getPeriodIncome(periodStart: Date, periodEnd: Date) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: periodStart, lte: periodEnd },
        isInternalTransfer: false,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.INCOME,
      },
      select: {
        amount: true,
        financialAccount: { select: { currency: true } },
        payment: {
          select: {
            charge: {
              select: {
                studentCharges: { select: { id: true } },
                membershipCharges: { select: { id: true } },
                accountCharge: { select: { category: { select: { name: true } } } }
              }
            }
          }
        }
      }
    });

    const incomeByCurrency: Record<string, { school: number, club: number, general: number, uncategorized: number, categories: Record<string, number>, total: number }> = {};

    transactions.forEach(t => {
      const cur = t.financialAccount?.currency || 'BOB';
      if (!incomeByCurrency[cur]) {
        incomeByCurrency[cur] = { school: 0, club: 0, general: 0, uncategorized: 0, categories: {}, total: 0 };
      }
      
      const amt = Number(t.amount);
      incomeByCurrency[cur].total += amt;

      const charge = t.payment?.charge;
      if (charge) {
        if (charge.studentCharges.length > 0) {
          incomeByCurrency[cur].school += amt;
        } else if (charge.membershipCharges.length > 0) {
          incomeByCurrency[cur].club += amt;
        } else if (charge.accountCharge) {
          const catName = charge.accountCharge.category?.name || 'Sin Categoría';
          incomeByCurrency[cur].general += amt;
          incomeByCurrency[cur].categories[catName] = (incomeByCurrency[cur].categories[catName] || 0) + amt;
        } else {
          incomeByCurrency[cur].uncategorized += amt;
        }
      } else {
        incomeByCurrency[cur].uncategorized += amt;
      }
    });

    return incomeByCurrency;
  }

  async getPeriodExpenses(periodStart: Date, periodEnd: Date) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: periodStart, lte: periodEnd },
        isInternalTransfer: false,
        status: TransactionStatus.COMPLETED,
        type: TransactionType.EXPENSE,
      },
      select: {
        amount: true,
        financialAccount: { select: { currency: true } },
        payment: {
          select: {
            charge: {
              select: {
                accountCharge: { select: { category: { select: { name: true } } } }
              }
            }
          }
        }
      }
    });

    const expensesByCurrency: Record<string, { categories: Record<string, number>, uncategorized: number, total: number }> = {};

    transactions.forEach(t => {
      const cur = t.financialAccount?.currency || 'BOB';
      if (!expensesByCurrency[cur]) {
        expensesByCurrency[cur] = { categories: {}, uncategorized: 0, total: 0 };
      }
      
      const amt = Number(t.amount);
      expensesByCurrency[cur].total += amt;

      const categoryName = t.payment?.charge?.accountCharge?.category?.name;
      if (categoryName) {
        expensesByCurrency[cur].categories[categoryName] = (expensesByCurrency[cur].categories[categoryName] || 0) + amt;
      } else {
        expensesByCurrency[cur].uncategorized += amt;
      }
    });

    return expensesByCurrency;
  }

  async getPeriodTransfers(periodStart: Date, periodEnd: Date) {
    const transfers = await this.prisma.internalTransfer.findMany({
      where: {
        date: { gte: periodStart, lte: periodEnd },
        status: TransferStatus.COMPLETED,
      },
      select: {
        date: true,
        amount: true,
        sourceTransaction: { select: { financialAccount: { select: { name: true, currency: true } } } },
        destinationTransaction: { select: { financialAccount: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    });

    return transfers.map(t => ({
      date: t.date,
      amount: Number(t.amount),
      currency: t.sourceTransaction?.financialAccount?.currency || 'BOB',
      sourceAccount: t.sourceTransaction?.financialAccount?.name || 'Desconocida',
      destinationAccount: t.destinationTransaction?.financialAccount?.name || 'Desconocida',
    }));
  }

  async getAccountingSummary(params?: AnalyticsPeriodParams) {
    const { periodStart, periodEnd } = this.getPeriodDates(params);

    const [treasury, receivables, payables, income, expenses, transfers] = await Promise.all([
      this.getTreasuryMetrics(),
      this.getReceivableMetrics(),
      this.getPayableMetrics(),
      this.getPeriodIncome(periodStart, periodEnd),
      this.getPeriodExpenses(periodStart, periodEnd),
      this.getPeriodTransfers(periodStart, periodEnd)
    ]);

    const periodResultByCurrency: Record<string, number> = {};
    const currencies = new Set([...Object.keys(income), ...Object.keys(expenses)]);
    currencies.forEach(cur => {
      const inc = income[cur]?.total || 0;
      const exp = expenses[cur]?.total || 0;
      periodResultByCurrency[cur] = inc - exp;
    });

    return {
      periodStart,
      periodEnd,
      treasury,
      receivables,
      payables,
      income,
      expenses,
      transfers,
      periodResultByCurrency,
    };
  }
}
