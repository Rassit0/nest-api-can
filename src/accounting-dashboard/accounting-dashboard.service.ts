import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StatusCharge, TransactionType } from 'src/generated/prisma/client';

@Injectable()
export class AccountingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(params?: { start?: string; end?: string }) {
    const today = new Date();
    
    // 1. Determinar el rango de fechas
    let periodStart: Date;
    let periodEnd: Date;

    if (params?.start && params?.end) {
      periodStart = new Date(params.start);
      periodEnd = new Date(params.end);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const pendingStatuses = [StatusCharge.PENDING, StatusCharge.PARTIAL];
    
    // 2. KPIs Globales de Deuda Viva (No se filtran por fecha porque es la deuda actual)
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

    // 2. Alertas Agrupadas Extensibles
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

    // 3. Gráficos: Flujo de Caja (Transacciones filtradas por rango)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: periodStart, lte: periodEnd },
        isInternalTransfer: false, // EXCLUIR TRANSFERENCIAS
      },
      select: {
        amount: true,
        type: true,
        transactionDate: true,
      }
    });

    let periodIncome = 0;
    let periodExpenses = 0;
    
    const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const isDaily = diffDays <= 31;
    
    let cashFlow = [];
    if (isDaily) {
      const daysMap: Record<string, { ingresos: number, egresos: number, name: string }> = {};
      for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const dateString = d.toISOString().split('T')[0];
        const dayNum = d.getDate();
        daysMap[dateString] = { ingresos: 0, egresos: 0, name: `${dayNum}` };
      }

      transactions.forEach(t => {
        const dateString = t.transactionDate.toISOString().split('T')[0];
        const amount = Number(t.amount);
        if (t.type === TransactionType.INCOME) {
          periodIncome += amount;
          if (daysMap[dateString]) daysMap[dateString].ingresos += amount;
        } else if (t.type === TransactionType.EXPENSE) {
          periodExpenses += amount;
          if (daysMap[dateString]) daysMap[dateString].egresos += amount;
        }
      });
      cashFlow = Object.values(daysMap);
    } else {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthsMap: Record<string, { ingresos: number, egresos: number, name: string }> = {};
      
      for (let m = new Date(periodStart); m <= periodEnd; m.setMonth(m.getMonth() + 1)) {
        const key = `${m.getFullYear()}-${m.getMonth()}`;
        monthsMap[key] = { ingresos: 0, egresos: 0, name: monthNames[m.getMonth()] };
      }
      
      transactions.forEach(t => {
        const key = `${t.transactionDate.getFullYear()}-${t.transactionDate.getMonth()}`;
        const amount = Number(t.amount);
        if (t.type === TransactionType.INCOME) {
          periodIncome += amount;
          if (monthsMap[key]) monthsMap[key].ingresos += amount;
        } else if (t.type === TransactionType.EXPENSE) {
          periodExpenses += amount;
          if (monthsMap[key]) monthsMap[key].egresos += amount;
        }
      });
      cashFlow = Object.values(monthsMap);
    }

    // 4. Gráficos: Gastos por Categoría (AccountCharges PAYABLE en el periodo)
    const payablesForCategories = await this.prisma.accountCharge.findMany({
      where: {
        charge: { 
          direction: 'PAYABLE',
          createdAt: { gte: periodStart, lte: periodEnd }
        },
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

    const totalAccountReceivables = Number(accountReceivables._sum.pendingAmount || 0);
    const totalMembershipReceivables = Number(membershipReceivables._sum.pendingAmount || 0);
    const totalPayables = Number(payables._sum.pendingAmount || 0);
    const liquidity = await this.getLiquidityMetrics();
    const netPosition = liquidity.totalInCash + liquidity.totalInBanks + totalAccountReceivables + totalMembershipReceivables - totalPayables;

    return {
      data: {
        kpis: {
          totalAccountReceivables,
          totalMembershipReceivables,
          totalPayables,
          receivablesTrend: 5, // TODO: comparar con periodo anterior
          payablesTrend: -2,   // TODO: comparar con periodo anterior
          monthlyIncome: periodIncome,
          monthlyExpenses: periodExpenses,
          totalInCash: liquidity.totalInCash,
          totalInBanks: liquidity.totalInBanks,
          netPosition,
        },
        alerts,
        cashFlow,
        expensesByCategory,
      }
    };
  }

  /**
   * Encapsula la lógica de cálculo de liquidez, considerando futuras 
   * evoluciones como multimoneda. Por ahora, se asume moneda base (BOB).
   */
  private async getLiquidityMetrics() {
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
      totalInBanks
    };
  }
}
