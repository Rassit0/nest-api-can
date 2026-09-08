import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MonthlyAccountingQueryDto } from './dto/monthly-accounting.dto';
import { TransactionStatus, TransactionType } from '../generated/prisma/client';

@Injectable()
export class MonthlyAccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountingData(query: MonthlyAccountingQueryDto) {
    const { year, month } = query;

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    // Get all financial accounts to guarantee zero-balances for inactive/empty ones
    const accounts = await this.prisma.financialAccount.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });

    const accountMap = new Map<string, { id: string; name: string; openingBalance: number; closingBalance: number }>();
    accounts.forEach(acc => {
      accountMap.set(acc.id, { id: acc.id, name: acc.name, openingBalance: 0, closingBalance: 0 });
    });

    // Calculate historical opening balance per account
    const historicalSums = await this.prisma.transaction.groupBy({
      by: ['financialAccountId', 'type'],
      _sum: { amount: true },
      where: {
        OR: [
          { status: TransactionStatus.COMPLETED },
          { status: 'CANCELLED', reversedBy: { isNot: null } },
        ],
        transactionDate: { lt: startDate },
      },
    });

    historicalSums.forEach(sum => {
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

    // Current month transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        financialAccount: { select: { id: true, name: true } },
        payment: {
          include: {
            charge: {
              include: {
                studentCharges: {
                  include: {
                    studentMembership: {
                      include: {
                        courseSeason: {
                          include: { course: { include: { school: { include: { discipline: true } } } } }
                        }
                      }
                    }
                  }
                },
                membershipCharges: {
                  include: {
                    playerMembership: {
                      include: {
                        teamSeason: {
                          include: { team: { include: { club: { include: { discipline: true } } } } }
                        }
                      }
                    }
                  }
                },
                accountCharge: {
                  include: { category: true }
                }
              }
            }
          }
        },
        internalTransferSource: true,
        internalTransferDest: true,
        reversedBy: { select: { id: true } },
      },
      orderBy: { transactionDate: 'asc' },
    });

    return {
      startDate,
      endDate,
      accounts: Array.from(accountMap.values()),
      transactions,
    };
  }
}
