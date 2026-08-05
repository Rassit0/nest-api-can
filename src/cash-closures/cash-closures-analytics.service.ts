import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export interface CashClosuresReportSummary {
  totalClosures: number;
  exactClosures: number;
  surplusCount: number;
  surplusAmount: number;
  shortageCount: number;
  shortageAmount: number;
}

export interface CashClosureDetail {
  id: string;
  closedAt: Date;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE';
  observations: string | null;
  createdBy: {
    name: string;
    lastName: string;
    email: string;
  };
}

export interface CashClosuresGroup {
  accountId: string;
  accountName: string;
  totalClosures: number;
  surplusAmount: number;
  shortageAmount: number;
  closures: CashClosureDetail[];
}

export interface CashClosuresReportDTO {
  summary: CashClosuresReportSummary;
  groups: CashClosuresGroup[];
}

@Injectable()
export class CashClosuresAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera el análisis de arqueos de caja para un periodo de tiempo.
   * Agrupa los resultados por caja y genera un resumen ejecutivo independiente del modelo de Prisma.
   */
  async getClosuresReportData(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<CashClosuresReportDTO> {
    const closures = await this.prisma.cashClosure.findMany({
      where: {
        closedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        financialAccount: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: {
            email: true,
            person: {
              select: { name: true, lastName: true },
            },
          },
        },
      },
      orderBy: {
        closedAt: 'desc', // Cronológico descendente por defecto dentro de Prisma
      },
    });

    const summary: CashClosuresReportSummary = {
      totalClosures: closures.length,
      exactClosures: 0,
      surplusCount: 0,
      surplusAmount: 0,
      shortageCount: 0,
      shortageAmount: 0,
    };

    const groupsMap = new Map<string, CashClosuresGroup>();

    for (const closure of closures) {
      const difference = closure.difference.toNumber();
      let status: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE' = 'CUADRADO';

      if (difference === 0) {
        summary.exactClosures++;
      } else if (difference > 0) {
        status = 'SOBRANTE';
        summary.surplusCount++;
        summary.surplusAmount += difference;
      } else {
        status = 'FALTANTE';
        summary.shortageCount++;
        summary.shortageAmount += Math.abs(difference);
      }

      const accountId = closure.financialAccountId;
      const accountName = closure.financialAccount.name;

      if (!groupsMap.has(accountId)) {
        groupsMap.set(accountId, {
          accountId,
          accountName,
          totalClosures: 0,
          surplusAmount: 0,
          shortageAmount: 0,
          closures: [],
        });
      }

      const group = groupsMap.get(accountId)!;
      group.totalClosures++;
      if (status === 'SOBRANTE') group.surplusAmount += difference;
      if (status === 'FALTANTE') group.shortageAmount += Math.abs(difference);

      group.closures.push({
        id: closure.id,
        closedAt: closure.closedAt,
        expectedBalance: closure.expectedBalance.toNumber(),
        actualBalance: closure.actualBalance.toNumber(),
        difference,
        status,
        observations: closure.observations,
        createdBy: {
          name: closure.createdBy?.person?.name || closure.createdBy?.email || 'Sistema',
          lastName: closure.createdBy?.person?.lastName || '',
          email: closure.createdBy?.email || 'N/A',
        },
      });
    }

    return {
      summary,
      // Ordenar las cajas por nombre alfabéticamente para facilitar la revisión
      groups: Array.from(groupsMap.values()).sort((a, b) => a.accountName.localeCompare(b.accountName)),
    };
  }
}
