import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MonthlyAccountingQueryDto } from './dto/monthly-accounting.dto';
import { TransactionStatus, TransferStatus } from '../generated/prisma/client';
import { DateUtils } from '../utils/date.utils';

export interface AccountAccountingSummary {
  id: string;
  name: string;
  accountNumber?: string | null;
  type: string;
  isActive: boolean;
  openingBalance: number;
}

@Injectable()
export class MonthlyAccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountingData(query: MonthlyAccountingQueryDto) {
    const { year, month } = query;

    // Timezone source of truth: envs.appTimezone (sin hardcodeo de offset UTC)
    const { startDate, endDate } = DateUtils.getMonthBoundariesInUTC(year, month);

    // 1. Obtener todas las cuentas financieras
    const accounts = await this.prisma.financialAccount.findMany({
      select: { id: true, name: true, accountNumber: true, type: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    const accountMap = new Map<string, AccountAccountingSummary>();
    accounts.forEach((acc) => {
      accountMap.set(acc.id, {
        id: acc.id,
        name: acc.name,
        accountNumber: acc.accountNumber,
        type: acc.type,
        isActive: acc.isActive,
        openingBalance: 0,
      });
    });

    // 2. Calcular saldos iniciales históricos (antes de startDate)
    // 2.1 Transacciones externas históricas
    const historicalSums = await this.prisma.transaction.groupBy({
      by: ['financialAccountId', 'type'],
      _sum: { amount: true },
      where: {
        isInternalTransfer: false,
        OR: [
          { status: TransactionStatus.COMPLETED },
          { status: TransactionStatus.CANCELLED, reversedBy: { isNot: null } },
        ],
        transactionDate: { lt: startDate },
      },
    });

    historicalSums.forEach((sum) => {
      const acc = accountMap.get(sum.financialAccountId);
      if (acc) {
        const amount = Number(sum._sum.amount) || 0;
        if (sum.type === 'INCOME') {
          acc.openingBalance += amount;
        } else if (sum.type === 'EXPENSE') {
          acc.openingBalance -= amount;
        }
      }
    });

    // 2.2 Transferencias internas históricas
    const historicalTransfers = await this.prisma.internalTransfer.findMany({
      where: {
        date: { lt: startDate },
        status: TransferStatus.COMPLETED,
      },
      include: {
        sourceTransaction: { select: { financialAccountId: true } },
        destinationTransaction: { select: { financialAccountId: true } },
      },
    });

    historicalTransfers.forEach((t) => {
      const amount = Number(t.amount) || 0;
      if (t.sourceTransaction) {
        const srcAcc = accountMap.get(t.sourceTransaction.financialAccountId);
        if (srcAcc) srcAcc.openingBalance -= amount;
      }
      if (t.destinationTransaction) {
        const destAcc = accountMap.get(t.destinationTransaction.financialAccountId);
        if (destAcc) destAcc.openingBalance += amount;
      }
    });

    // 3. Transacciones externas del período (INCOME y EXPENSE)
    const externalTransactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lt: endDate,
        },
        isInternalTransfer: false,
      },
      include: {
        financialAccount: { select: { id: true, name: true, accountNumber: true } },
        payerPerson: { select: { name: true, lastName: true, secondLastName: true } },
        payerCompany: { select: { name: true } },
        payment: {
          include: {
            charge: {
              include: {
                studentCharges: {
                  include: {
                    studentMembership: {
                      include: {
                        courseSeason: {
                          include: { course: { include: { school: { include: { discipline: true } } } } },
                        },
                      },
                    },
                  },
                },
                membershipCharges: {
                  include: {
                    playerMembership: {
                      include: {
                        teamSeason: {
                          include: { team: { include: { club: { include: { discipline: true } } } } },
                        },
                      },
                    },
                  },
                },
                accountCharge: {
                  include: { category: true },
                },
              },
            },
          },
        },
        reverses: {
          include: { payment: true },
        },
        reversedBy: { select: { id: true } },
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    // 4. Transferencias internas del período (solo efectivas / COMPLETED)
    const internalTransfers = await this.prisma.internalTransfer.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
        status: TransferStatus.COMPLETED,
      },
      include: {
        sourceTransaction: {
          include: {
            financialAccount: { select: { id: true, name: true, accountNumber: true } },
          },
        },
        destinationTransaction: {
          include: {
            financialAccount: { select: { id: true, name: true, accountNumber: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      year,
      month,
      startDate,
      endDate,
      accounts: Array.from(accountMap.values()),
      transactions: externalTransactions,
      internalTransfers,
    };
  }
}
