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

    // 1. Determinar el rango de fechas usando el nuevo servicio analítico
    const { periodStart, periodEnd } = this.analytics.getPeriodDates(params);
    console.log({ periodStart, periodEnd });

    const pendingStatuses = [StatusCharge.PENDING, StatusCharge.PARTIAL];

    // 2. Posición Global Financiera
    const { treasury, financial } =
      await this.analytics.getGlobalFinancialPosition();

    // 2. Alertas Agrupadas Extensibles
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Contar Cuentas Administrativas vencidas o por vencer (Receivables)
    const pendingAccountReceivables = await this.prisma.accountCharge.count({
      where: {
        charge: {
          direction: 'RECEIVABLE',
          status: { in: pendingStatuses },
          dueDate: { lte: nextWeek },
        },
      },
    });

    // Contar Cuentas Administrativas vencidas o por vencer (Payables)
    const pendingAccountPayables = await this.prisma.accountCharge.count({
      where: {
        charge: {
          direction: 'PAYABLE',
          status: { in: pendingStatuses },
          dueDate: { lte: nextWeek },
        },
      },
    });

    // Contar Membresías pendientes (Receivables)
    const pendingMemberships = await this.prisma.membershipCharge.count({
      where: {
        charge: {
          direction: 'RECEIVABLE',
          status: { in: pendingStatuses },
          dueDate: { lte: nextWeek },
        },
      },
    });

    const alerts = [];

    // Alertas de Cobros (Receivables)
    if (pendingMemberships > 0) {
      alerts.push({
        context: 'Memberships',
        count: pendingMemberships,
        label:
          pendingMemberships === 1
            ? 'Membresía pendiente'
            : 'Membresías pendientes',
        href: '/admin/memberships?status=PENDING', // TODO: Ajustar a las URLs correctas del frontend cuando existan
        severity: 'warning',
        type: 'RECEIVABLE',
      });
    }

    if (pendingAccountReceivables > 0) {
      alerts.push({
        context: 'AccountCharges',
        count: pendingAccountReceivables,
        label:
          pendingAccountReceivables === 1
            ? 'Cuenta administrativa pendiente'
            : 'Cuentas administrativas pendientes',
        href: '/admin/accounting/receivables?status=PENDING',
        severity: 'danger',
        type: 'RECEIVABLE',
      });
    }

    // Alertas de Pagos (Payables)
    if (pendingAccountPayables > 0) {
      alerts.push({
        context: 'AccountCharges',
        count: pendingAccountPayables,
        label:
          pendingAccountPayables === 1
            ? 'Obligación de pago pendiente'
            : 'Obligaciones de pago pendientes',
        href: '/admin/accounting/payables?status=PENDING',
        severity: 'danger',
        type: 'PAYABLE',
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
      },
    });

    let periodIncome = 0;
    let periodExpenses = 0;

    const diffDays = Math.ceil(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const isDaily = diffDays <= 31;

    const ONE_DAY = 24 * 60 * 60 * 1000;

    let cashFlow = [];
    if (isDaily) {
      const daysMap: Record<
        number,
        { ingresos: number; egresos: number; name: string }
      > = {};
      const numDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime() + 1) / ONE_DAY,
      );

      for (let i = 0; i < numDays; i++) {
        // Obtenemos la fecha de este bloque sumando los días a periodStart
        const bucketDate = new Date(periodStart.getTime() + i * ONE_DAY);
        // Usamos getDate() o el frontend se encargará. Aquí enviamos el día que corresponde al inicio del bloque.
        daysMap[i] = {
          ingresos: 0,
          egresos: 0,
          name: `${bucketDate.getDate()}`,
        };
      }

      transactions.forEach((t) => {
        const chunkIndex = Math.floor(
          (t.transactionDate.getTime() - periodStart.getTime()) / ONE_DAY,
        );
        const amount = Number(t.amount);
        if (t.type === TransactionType.INCOME) {
          periodIncome += amount;
          if (daysMap[chunkIndex]) daysMap[chunkIndex].ingresos += amount;
        } else if (t.type === TransactionType.EXPENSE) {
          periodExpenses += amount;
          if (daysMap[chunkIndex]) daysMap[chunkIndex].egresos += amount;
        }
      });
      cashFlow = Object.values(daysMap);
    } else {
      const monthNames = [
        'Ene',
        'Feb',
        'Mar',
        'Abr',
        'May',
        'Jun',
        'Jul',
        'Ago',
        'Sep',
        'Oct',
        'Nov',
        'Dic',
      ];
      const monthsMap: Record<
        string,
        { ingresos: number; egresos: number; name: string }
      > = {};

      for (
        let m = new Date(periodStart);
        m <= periodEnd;
        m.setMonth(m.getMonth() + 1)
      ) {
        const key = `${m.getFullYear()}-${m.getMonth()}`;
        monthsMap[key] = {
          ingresos: 0,
          egresos: 0,
          name: monthNames[m.getMonth()],
        };
      }

      transactions.forEach((t) => {
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
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        category: { isNot: null },
      },
      select: {
        category: { select: { name: true } },
        charge: { select: { amount: true } },
      },
    });

    const expensesMap: Record<string, number> = {};
    payablesForCategories.forEach((p) => {
      if (p.category) {
        const catName = p.category.name;
        const amount = Number(p.charge.amount);
        if (!expensesMap[catName]) expensesMap[catName] = 0;
        expensesMap[catName] += amount;
      }
    });

    const expensesByCategory = Object.keys(expensesMap)
      .map((name) => ({
        name,
        value: expensesMap[name],
      }))
      .sort((a, b) => b.value - a.value);

    return {
      data: {
        kpis: {
          treasury: {
            availableBalance: treasury.availableBalance,
          },
          financial: {
            totalReceivables: financial.totalReceivables,
            totalPayables: financial.totalPayables,
            netPosition: financial.netPosition,
            receivablesTrend: 5, // TODO: comparar con periodo anterior
            payablesTrend: -2, // TODO: comparar con periodo anterior
          },
          // Temporalmente mantenemos estos si el frontend los usa, o los movemos
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
