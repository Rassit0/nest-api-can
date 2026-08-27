import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType } from 'src/generated/prisma/client';
import { AccountingAnalyticsService } from 'src/accounting-analytics/accounting-analytics.service';

@Injectable()
export class AccountingDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AccountingAnalyticsService,
  ) {}

  async getSummary(params?: { start?: string; end?: string }) {
    const today = new Date();
    const { periodStart, periodEnd } = this.analytics.getPeriodDates(params);
    const pendingStatuses = [StatusCharge.PENDING, StatusCharge.PARTIAL];

    const { treasury, receivables, payables, income, expenses, periodResultByCurrency } =
      await this.analytics.getAccountingSummary(params);

    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const pendingAccountReceivables = await this.prisma.accountCharge.count({
      where: { charge: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } } },
    });
    const pendingAccountPayables = await this.prisma.accountCharge.count({
      where: { charge: { direction: 'PAYABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } } },
    });
    const pendingMemberships = await this.prisma.membershipCharge.count({
      where: { charge: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } } },
    });
    const pendingStudentCharges = await this.prisma.studentCharge.count({
      where: { charge: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } } },
    });

    const alerts = [];
    if (pendingStudentCharges > 0) alerts.push({ context: 'StudentCharges', count: pendingStudentCharges, label: pendingStudentCharges === 1 ? 'Cuota escolar pendiente' : 'Cuotas escolares pendientes', href: '/admin/student-charges?status=PENDING', severity: 'warning', type: 'RECEIVABLE' });
    if (pendingMemberships > 0) alerts.push({ context: 'Memberships', count: pendingMemberships, label: pendingMemberships === 1 ? 'Membresía pendiente' : 'Membresías pendientes', href: '/admin/memberships?status=PENDING', severity: 'warning', type: 'RECEIVABLE' });
    if (pendingAccountReceivables > 0) alerts.push({ context: 'AccountCharges', count: pendingAccountReceivables, label: pendingAccountReceivables === 1 ? 'Cuenta administrativa pendiente' : 'Cuentas administrativas pendientes', href: '/admin/accounting/receivables?status=PENDING', severity: 'danger', type: 'RECEIVABLE' });
    if (pendingAccountPayables > 0) alerts.push({ context: 'AccountCharges', count: pendingAccountPayables, label: pendingAccountPayables === 1 ? 'Obligación de pago pendiente' : 'Obligaciones de pago pendientes', href: '/admin/accounting/payables?status=PENDING', severity: 'danger', type: 'PAYABLE' });

    const transactions = await this.prisma.transaction.findMany({
      where: { transactionDate: { gte: periodStart, lte: periodEnd }, isInternalTransfer: false },
      select: { amount: true, type: true, transactionDate: true },
    });

    let periodIncome = 0;
    let periodExpenses = 0;
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / ONE_DAY);
    let cashFlow = [];

    if (diffDays <= 31) {
      const daysMap: Record<number, { ingresos: number; egresos: number; name: string }> = {};
      const numDays = Math.ceil((periodEnd.getTime() - periodStart.getTime() + 1) / ONE_DAY);
      for (let i = 0; i < numDays; i++) daysMap[i] = { ingresos: 0, egresos: 0, name: `${new Date(periodStart.getTime() + i * ONE_DAY).getDate()}` };

      transactions.forEach((t) => {
        const chunkIndex = Math.floor((t.transactionDate.getTime() - periodStart.getTime()) / ONE_DAY);
        const amount = Number(t.amount);
        if (t.type === TransactionType.INCOME) { periodIncome += amount; if (daysMap[chunkIndex]) daysMap[chunkIndex].ingresos += amount; }
        else if (t.type === TransactionType.EXPENSE) { periodExpenses += amount; if (daysMap[chunkIndex]) daysMap[chunkIndex].egresos += amount; }
      });
      cashFlow = Object.values(daysMap);
    } else {
      const monthsMap: Record<string, { ingresos: number; egresos: number; name: string }> = {};
      for (let m = new Date(periodStart); m <= periodEnd; m.setMonth(m.getMonth() + 1)) monthsMap[`${m.getFullYear()}-${m.getMonth()}`] = { ingresos: 0, egresos: 0, name: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m.getMonth()] };
      
      transactions.forEach((t) => {
        const key = `${t.transactionDate.getFullYear()}-${t.transactionDate.getMonth()}`;
        const amount = Number(t.amount);
        if (t.type === TransactionType.INCOME) { periodIncome += amount; if (monthsMap[key]) monthsMap[key].ingresos += amount; }
        else if (t.type === TransactionType.EXPENSE) { periodExpenses += amount; if (monthsMap[key]) monthsMap[key].egresos += amount; }
      });
      cashFlow = Object.values(monthsMap);
    }

    const payablesForCategories = await this.prisma.accountCharge.findMany({
      where: { charge: { direction: 'PAYABLE', createdAt: { gte: periodStart, lte: periodEnd } }, category: { isNot: null } },
      select: { category: { select: { name: true } }, charge: { select: { amount: true } } },
    });

    const expensesMap: Record<string, number> = {};
    payablesForCategories.forEach((p) => {
      if (p.category) {
        expensesMap[p.category.name] = (expensesMap[p.category.name] || 0) + Number(p.charge.amount);
      }
    });
    const expensesByCategory = Object.keys(expensesMap).map((name) => ({ name, value: expensesMap[name] })).sort((a, b) => b.value - a.value);

    // Default to BOB for the dashboard totals to avoid breaking the frontend entirely
    const availableBalance = treasury.liquidityByCurrency['BOB'] || 0;
    const periodResult = periodIncome - periodExpenses;

    return {
      data: {
        kpis: {
          treasury: { availableBalance },
          financial: {
            totalReceivables: receivables.receivables.total,
            totalPayables: payables.payables.total,
            periodResult,
            receivablesTrend: 5,
            payablesTrend: -2,
          },
          monthlyIncome: periodIncome,
          monthlyExpenses: periodExpenses,
        },
        alerts,
        cashFlow,
        expensesByCategory,
        accounts: treasury.accounts,
      },
    };
  }
}
