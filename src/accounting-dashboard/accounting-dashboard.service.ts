import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType } from 'src/generated/prisma/client';

@Injectable()
export class AccountingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const pendingStatuses = [StatusCharge.PENDING, StatusCharge.PARTIAL];
    
    // 1. KPIs Globales
    const [receivables, payables] = await Promise.all([
      this.prisma.charge.aggregate({
        where: { direction: 'RECEIVABLE', status: { in: pendingStatuses } },
        _sum: { pendingAmount: true },
      }),
      this.prisma.charge.aggregate({
        where: { direction: 'PAYABLE', status: { in: pendingStatuses } },
        _sum: { pendingAmount: true },
      }),
    ]);

    // 2. Alertas Agrupadas Extensibles
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Contar Cuentas Administrativas vencidas o por vencer (Receivables)
    const pendingAccountReceivables = await this.prisma.accountCharge.count({
      where: {
        charge: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } },
      }
    });

    // Contar Cuentas Administrativas vencidas o por vencer (Payables)
    const pendingAccountPayables = await this.prisma.accountCharge.count({
      where: {
        charge: { direction: 'PAYABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } },
      }
    });

    // Contar Membresías pendientes (Receivables)
    const pendingMemberships = await this.prisma.membershipCharge.count({
      where: {
        charge: { direction: 'RECEIVABLE', status: { in: pendingStatuses }, dueDate: { lte: nextWeek } },
      }
    });

    const alerts = [];

    // Alertas de Cobros (Receivables)
    if (pendingMemberships > 0) {
      alerts.push({
        context: 'Memberships',
        count: pendingMemberships,
        label: pendingMemberships === 1 ? 'Membresía pendiente' : 'Membresías pendientes',
        href: '/admin/memberships?status=PENDING', // TODO: Ajustar a las URLs correctas del frontend cuando existan
        severity: 'warning',
        type: 'RECEIVABLE'
      });
    }

    if (pendingAccountReceivables > 0) {
      alerts.push({
        context: 'AccountCharges',
        count: pendingAccountReceivables,
        label: pendingAccountReceivables === 1 ? 'Cuenta administrativa pendiente' : 'Cuentas administrativas pendientes',
        href: '/admin/accounting/receivables?status=PENDING',
        severity: 'danger',
        type: 'RECEIVABLE'
      });
    }

    // Alertas de Pagos (Payables)
    if (pendingAccountPayables > 0) {
      alerts.push({
        context: 'AccountCharges',
        count: pendingAccountPayables,
        label: pendingAccountPayables === 1 ? 'Obligación de pago pendiente' : 'Obligaciones de pago pendientes',
        href: '/admin/accounting/payables?status=PENDING',
        severity: 'danger',
        type: 'PAYABLE'
      });
    }

    // 3. Gráficos: Flujo de Caja (Transacciones del año actual)
    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: startOfYear, lte: endOfYear },
      },
      select: {
        amount: true,
        type: true,
        transactionDate: true,
      }
    });

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const cashFlow = Array.from({ length: 12 }, (_, i) => ({
      name: monthNames[i],
      ingresos: 0,
      egresos: 0,
    }));

    let currentMonthIncome = 0;
    let currentMonthExpenses = 0;
    const currentMonth = today.getMonth();

    transactions.forEach(t => {
      const month = t.transactionDate.getMonth();
      const amount = Number(t.amount);
      if (t.type === TransactionType.INCOME) {
        cashFlow[month].ingresos += amount;
        if (month === currentMonth) currentMonthIncome += amount;
      } else if (t.type === TransactionType.EXPENSE) {
        cashFlow[month].egresos += amount;
        if (month === currentMonth) currentMonthExpenses += amount;
      }
    });

    // 4. Gráficos: Gastos por Categoría (AccountCharges PAYABLE)
    const payablesForCategories = await this.prisma.accountCharge.findMany({
      where: {
        charge: { direction: 'PAYABLE' },
        category: { isNot: null }
      },
      select: {
        category: { select: { name: true } },
        charge: { select: { amount: true } }
      }
    });

    const expensesMap: Record<string, number> = {};
    payablesForCategories.forEach(p => {
      if (p.category) {
        const catName = p.category.name;
        const amount = Number(p.charge.amount);
        if (!expensesMap[catName]) expensesMap[catName] = 0;
        expensesMap[catName] += amount;
      }
    });
    
    const expensesByCategory = Object.keys(expensesMap).map(name => ({
      name,
      value: expensesMap[name]
    })).sort((a, b) => b.value - a.value);

    return {
      data: {
        kpis: {
          totalReceivables: receivables._sum.pendingAmount || 0,
          totalPayables: payables._sum.pendingAmount || 0,
          receivablesTrend: 5,
          payablesTrend: -2,
          monthlyIncome: currentMonthIncome,
          monthlyExpenses: currentMonthExpenses,
        },
        alerts,
        cashFlow,
        expensesByCategory,
      }
    };
  }
}
