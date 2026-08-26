import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TransactionStatus } from 'src/generated/prisma/client';
import { MonthlyCashflowQueryDto } from './dto/monthly-cashflow.dto';

export interface MonthlyCashflowData {
  year: number;
  month: number;
  openingBalance: number;
  closingBalance: number;
  columns: {
    incomes: Array<{ key: string; accountName: string; paymentMethod: string }>;
    expenses: Array<{ key: string; accountName: string; paymentMethod: string }>;
  };
  days: Array<{
    date: Date;
    incomes: Record<string, number>;
    expenses: Record<string, number>;
    dailyTotalIncome: number;
    dailyTotalExpense: number;
    dailyNetFlow: number;
    dailyAccumulatedBalance: number;
  }>;
  monthlyTotals: {
    incomes: Record<string, number>;
    expenses: Record<string, number>;
    totalIncome: number;
    totalExpense: number;
    netFlow: number;
  };
  details: Array<{
    date: Date;
    transactionId: string;
    type: 'INCOME' | 'EXPENSE';
    accountName: string;
    paymentMethod: string;
    categoryName: string;
    origin: string;
    discipline: string | null;
    beneficiary: string | null;
    payer: string | null;
    reference: string | null;
    amount: number;
  }>;
  internalTransfers: Array<{
    date: Date;
    transactionId: string;
    sourceAccount: string;
    destinationAccount: string;
    paymentMethod: string;
    amount: number;
    reference: string | null;
  }>;
}

@Injectable()
export class MonthlyCashflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashflowData(query: MonthlyCashflowQueryDto): Promise<MonthlyCashflowData> {
    const { year, month } = query;

    // Fechas UTC
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // Saldo Inicial (Opening Balance)
    const [pastIncomes, pastExpenses] = await Promise.all([
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'INCOME',
          isInternalTransfer: false,
          status: TransactionStatus.COMPLETED,
          transactionDate: { lt: startDate },
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          isInternalTransfer: false,
          status: TransactionStatus.COMPLETED,
          transactionDate: { lt: startDate },
        },
      }),
    ]);

    const openingBalance =
      (Number(pastIncomes._sum.amount) || 0) - (Number(pastExpenses._sum.amount) || 0);

    // Obtener transacciones del mes
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: { gte: startDate, lt: endDate },
        status: TransactionStatus.COMPLETED,
      },
      select: {
        id: true,
        transactionDate: true,
        type: true,
        amount: true,
        paymentMethod: true,
        isInternalTransfer: true,
        reference: true,
        notes: true,
        financialAccountId: true,
        financialAccount: { select: { name: true } },
        payerPerson: { select: { name: true, lastName: true } },
        internalTransferSource: {
          select: { destinationTransaction: { select: { financialAccount: { select: { name: true } } } } },
        },
        payment: {
          select: {
            charge: {
              select: {
                studentCharges: { select: { studentMembership: { select: { courseSeason: { select: { course: { select: { school: { select: { discipline: { select: { name: true } } } } } } } } } } } },
                membershipCharges: { select: { playerMembership: { select: { teamSeason: { select: { team: { select: { club: { select: { discipline: { select: { name: true } } } } } } } } } } } },
                accountCharge: { select: { person: { select: { name: true, lastName: true } }, category: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { transactionDate: 'asc' },
    });

    const data: MonthlyCashflowData = {
      year,
      month,
      openingBalance,
      closingBalance: 0,
      columns: { incomes: [], expenses: [] },
      days: [],
      monthlyTotals: { incomes: {}, expenses: {}, totalIncome: 0, totalExpense: 0, netFlow: 0 },
      details: [],
      internalTransfers: [],
    };

    // Inicializar días
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = 1; i <= daysInMonth; i++) {
      data.days.push({
        date: new Date(Date.UTC(year, month - 1, i, 0, 0, 0, 0)),
        incomes: {},
        expenses: {},
        dailyTotalIncome: 0,
        dailyTotalExpense: 0,
        dailyNetFlow: 0,
        dailyAccumulatedBalance: 0,
      });
    }

    const incomeColumnsMap = new Map<string, { key: string; accountName: string; paymentMethod: string }>();
    const expenseColumnsMap = new Map<string, { key: string; accountName: string; paymentMethod: string }>();

    let currentAccumulatedBalance = openingBalance;

    // Procesar cada transacción
    for (const tx of transactions) {
      const dayIndex = tx.transactionDate.getUTCDate() - 1;
      const amount = Number(tx.amount);
      const accName = tx.financialAccount.name;
      const method = tx.paymentMethod || 'UNDEFINED';
      const key = `${tx.financialAccountId}_${method}`;

      const reference = tx.reference || tx.notes || null;
      let categoryName = 'Sin Categoría';
      let origin = 'Directo';
      let discipline: string | null = null;
      let beneficiary: string | null = null;
      const payer = tx.payerPerson ? `${tx.payerPerson.name} ${tx.payerPerson.lastName}`.trim() : null;

      if (tx.payment?.charge) {
        const c = tx.payment.charge;
        if (c.studentCharges.length > 0) {
          origin = 'Escuela';
          discipline = c.studentCharges[0]?.studentMembership?.courseSeason?.course?.school?.discipline?.name || null;
        } else if (c.membershipCharges.length > 0) {
          origin = 'Equipo';
          discipline = c.membershipCharges[0]?.playerMembership?.teamSeason?.team?.club?.discipline?.name || null;
        } else if (c.accountCharge) {
          origin = 'Cargo Administrativo';
          categoryName = c.accountCharge.category?.name || 'Sin Categoría';
          if (c.accountCharge.person) {
            beneficiary = `${c.accountCharge.person.name} ${c.accountCharge.person.lastName}`.trim();
          }
        }
      }

      if (tx.isInternalTransfer) {
        // En InternalTransfer sourceTransactionId genera un EXPENSE, destinationTransactionId genera un INCOME.
        // Solo consideraremos una cara de la moneda para listarlo en "Movimientos Internos" para no duplicar en la lista.
        // Tomamos la cara EXPENSE para mostrar Origen -> Destino
        if (tx.type === 'EXPENSE') {
          const destName = tx.internalTransferSource?.destinationTransaction?.financialAccount?.name || 'Desconocido';
          data.internalTransfers.push({
            date: tx.transactionDate,
            transactionId: tx.id,
            sourceAccount: accName,
            destinationAccount: destName,
            paymentMethod: method,
            amount,
            reference,
          });
        }
        continue;
      }

      // Transacciones normales
      data.details.push({
        date: tx.transactionDate,
        transactionId: tx.id,
        type: tx.type,
        accountName: accName,
        paymentMethod: method,
        categoryName,
        origin,
        discipline,
        beneficiary,
        payer,
        reference,
        amount,
      });

      if (tx.type === 'INCOME') {
        if (!incomeColumnsMap.has(key)) {
          incomeColumnsMap.set(key, { key, accountName: accName, paymentMethod: method });
        }
        data.days[dayIndex].incomes[key] = (data.days[dayIndex].incomes[key] || 0) + amount;
        data.days[dayIndex].dailyTotalIncome += amount;
        
        data.monthlyTotals.incomes[key] = (data.monthlyTotals.incomes[key] || 0) + amount;
        data.monthlyTotals.totalIncome += amount;
      } else if (tx.type === 'EXPENSE') {
        if (!expenseColumnsMap.has(key)) {
          expenseColumnsMap.set(key, { key, accountName: accName, paymentMethod: method });
        }
        data.days[dayIndex].expenses[key] = (data.days[dayIndex].expenses[key] || 0) + amount;
        data.days[dayIndex].dailyTotalExpense += amount;
        
        data.monthlyTotals.expenses[key] = (data.monthlyTotals.expenses[key] || 0) + amount;
        data.monthlyTotals.totalExpense += amount;
      }
    }

    // Convertir mapas de columnas a arrays ordenados por nombre de cuenta
    data.columns.incomes = Array.from(incomeColumnsMap.values()).sort((a, b) => a.accountName.localeCompare(b.accountName));
    data.columns.expenses = Array.from(expenseColumnsMap.values()).sort((a, b) => a.accountName.localeCompare(b.accountName));

    // Calcular saldos acumulados por día
    for (const day of data.days) {
      day.dailyNetFlow = day.dailyTotalIncome - day.dailyTotalExpense;
      currentAccumulatedBalance += day.dailyNetFlow;
      day.dailyAccumulatedBalance = currentAccumulatedBalance;
    }

    data.monthlyTotals.netFlow = data.monthlyTotals.totalIncome - data.monthlyTotals.totalExpense;
    data.closingBalance = openingBalance + data.monthlyTotals.netFlow;

    return data;
  }
}
