import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { envs } from 'src/config/envs';
import { DateUtils } from 'src/utils/date.utils';
import {
  TransactionStatus,
  TransactionType,
  StatusCharge,
  StudentMembershipStatus,
  PlayerMembershipStatus,
  StatusCourseSeason,
} from 'src/generated/prisma/client';
import { buildValidOccupancyCondition } from 'src/common/helpers/capacity.helper';
import {
  DashboardSummaryQueryDto,
  DashboardActivityQueryDto,
} from './dto/dashboard-query.dto';
import {
  DashboardSummaryResponseDto,
  DashboardLiquidityDto,
  DashboardFinancialFlowDto,
  DashboardReceivablesSummaryDto,
  DashboardCommunitySummaryDto,
  DashboardCoursesOccupancyDto,
  DashboardShiftOccupancyItemDto,
  DashboardAlertItemDto,
} from './dto/dashboard-summary.dto';
import {
  DashboardActivityResponseDto,
} from './dto/dashboard-activity.dto';
import { DashboardActivityMapper } from './mappers/dashboard-activity.mapper';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    query: DashboardSummaryQueryDto,
    userPermissions: string[],
  ): Promise<DashboardSummaryResponseDto> {
    // 1. Resolver fechas del período respetando envs.appTimezone
    const { periodStart, periodEnd, label } = this.resolvePeriod(query);

    // 2. Determinar permisos de sección
    const canReadAccounts = userPermissions.includes('READ_FINANCIAL_ACCOUNTS');
    const canReadFlow =
      userPermissions.includes('READ_TRANSACTIONS') ||
      userPermissions.includes('READ_CASH_FLOW');
    const canReadReceivables =
      userPermissions.includes('READ_CHARGES') ||
      userPermissions.includes('READ_ACCOUNT_CHARGES');
    const canReadCommunity =
      userPermissions.includes('READ_STUDENT_MEMBERSHIPS') ||
      userPermissions.includes('READ_PLAYER_MEMBERSHIPS');
    const canReadCourses =
      userPermissions.includes('READ_COURSE_SEASONS') ||
      userPermissions.includes('READ_SHIFTS');

    // 3. Ejecutar agregaciones autorizadas concurrentemente
    const [
      liquidity,
      financialFlow,
      receivables,
      community,
      coursesOccupancy,
    ] = await Promise.all([
      canReadAccounts ? this.getLiquidityMetrics() : Promise.resolve(undefined),
      canReadFlow ? this.getFinancialFlowMetrics(periodStart, periodEnd) : Promise.resolve(undefined),
      canReadReceivables ? this.getReceivablesMetrics() : Promise.resolve(undefined),
      canReadCommunity ? this.getCommunityMetrics() : Promise.resolve(undefined),
      canReadCourses ? this.getCoursesOccupancyMetrics() : Promise.resolve(undefined),
    ]);

    // 4. Derivar alertas seguras sin repetir consultas de ocupación o cuentas
    const alerts = await this.getSafeAlerts(userPermissions, coursesOccupancy, receivables);

    return {
      period: {
        from: periodStart.toISOString(),
        to: periodEnd.toISOString(),
        label,
      },
      liquidity,
      financialFlow,
      receivables,
      community,
      coursesOccupancy,
      alerts,
    };
  }

  async getActivity(
    query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityResponseDto> {
    const limit = query.limit || 10;

    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: { person: true },
        },
      },
    });

    const items = logs.map((log) => DashboardActivityMapper.mapToItem(log));

    return {
      items,
      total: items.length,
    };
  }

  // --- Sub-métodos de agregación canónica ---

  async getLiquidityMetrics(): Promise<DashboardLiquidityDto> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        cachedBalance: true,
      },
      orderBy: { name: 'asc' },
    });

    let total = 0;
    const mappedAccounts = accounts.map((acc) => {
      const balance = acc.cachedBalance ? Number(acc.cachedBalance) : 0;
      total += balance;
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency || 'BOB',
        balance,
        percentage: 0,
      };
    });

    mappedAccounts.forEach((acc) => {
      acc.percentage = total > 0 ? Number(((acc.balance / total) * 100).toFixed(2)) : 0;
    });

    return {
      total,
      currency: 'BOB',
      activeAccountsCount: accounts.length,
      accounts: mappedAccounts,
    };
  }

  async getFinancialFlowMetrics(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<DashboardFinancialFlowDto> {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const diffDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / ONE_DAY);
    const isDaily = diffDays <= 31;

    // Agregación en base de datos PostgreSQL (máximo 24 a 62 filas resultantes en lugar de cientos de registros)
    const dateGroupingFormat = isDaily ? 'YYYY-MM-DD' : 'YYYY-MM';
    const appTimezone = envs.appTimezone;

    const aggregatedRows = await this.prisma.$queryRaw<
      Array<{ date_bucket: string; type: TransactionType; total: string | number }>
    >`
      SELECT
        TO_CHAR((transaction_date AT TIME ZONE 'UTC') AT TIME ZONE ${appTimezone}, ${dateGroupingFormat}) AS date_bucket,
        type,
        SUM(amount) AS total
      FROM transactions
      WHERE transaction_date >= ${periodStart} AND transaction_date <= ${periodEnd}
        AND status = 'COMPLETED'::"TransactionStatus"
        AND is_internal_transfer = false
      GROUP BY 1, 2
      ORDER BY 1;
    `;

    let totalIncome = 0;
    let totalExpense = 0;
    const pointsMap = new Map<string, { date: string; income: number; expense: number; netMargin: number }>();

    // Inicializar puntos cronológicos para rango diario
    if (isDaily) {
      for (let t = periodStart.getTime(); t <= periodEnd.getTime(); t += ONE_DAY) {
        const d = new Date(t);
        const key = DateUtils.formatLocalDate(d, 'en-CA');
        if (!pointsMap.has(key)) {
          pointsMap.set(key, { date: key, income: 0, expense: 0, netMargin: 0 });
        }
      }
    }

    aggregatedRows.forEach((row) => {
      const amt = Number(row.total);
      const dateStr = row.date_bucket;

      if (!pointsMap.has(dateStr)) {
        pointsMap.set(dateStr, { date: dateStr, income: 0, expense: 0, netMargin: 0 });
      }
      const point = pointsMap.get(dateStr)!;

      if (row.type === TransactionType.INCOME) {
        totalIncome += amt;
        point.income += amt;
      } else if (row.type === TransactionType.EXPENSE) {
        totalExpense += amt;
        point.expense += amt;
      }
      point.netMargin = point.income - point.expense;
    });

    return {
      totalIncome,
      totalExpense,
      netResult: totalIncome - totalExpense,
      series: Array.from(pointsMap.values()),
    };
  }

  async getReceivablesMetrics(): Promise<DashboardReceivablesSummaryDto> {
    const today = new Date();

    // Agregación 100% en PostgreSQL: 0 filas transferidas a memoria Node.js
    const [aggTotal, aggOverdue] = await Promise.all([
      this.prisma.charge.aggregate({
        where: {
          direction: 'RECEIVABLE',
          status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
        },
        _sum: { pendingAmount: true },
        _count: { id: true },
      }),
      this.prisma.charge.aggregate({
        where: {
          direction: 'RECEIVABLE',
          status: { in: [StatusCharge.PENDING, StatusCharge.PARTIAL] },
          dueDate: { lt: today },
        },
        _sum: { pendingAmount: true },
        _count: { id: true },
      }),
    ]);

    const totalPending = Number(aggTotal._sum.pendingAmount || 0);
    const pendingChargesCount = aggTotal._count.id || 0;
    const overdueAmount = Number(aggOverdue._sum.pendingAmount || 0);
    const overdueChargesCount = aggOverdue._count.id || 0;

    const currentAmount = totalPending - overdueAmount;
    const overduePercentage =
      totalPending > 0 ? Number(((overdueAmount / totalPending) * 100).toFixed(2)) : 0;

    return {
      totalPending,
      overdueAmount,
      currentAmount,
      overduePercentage,
      pendingChargesCount,
      overdueChargesCount,
    };
  }

  async getCommunityMetrics(): Promise<DashboardCommunitySummaryDto> {
    const [studentMemberships, playerMemberships] = await Promise.all([
      this.prisma.studentMembership.findMany({
        where: { status: StudentMembershipStatus.ACTIVE },
        select: { student: { select: { personId: true } } },
      }),
      this.prisma.playerMembership.findMany({
        where: { status: PlayerMembershipStatus.ACTIVE },
        select: { player: { select: { personId: true } } },
      }),
    ]);

    const studentPersonIds = new Set(studentMemberships.map((m) => m.student.personId));
    const playerPersonIds = new Set(playerMemberships.map((m) => m.player.personId));

    const allUniquePersonIds = new Set([...studentPersonIds, ...playerPersonIds]);
    let dualAthletesCount = 0;
    for (const pId of studentPersonIds) {
      if (playerPersonIds.has(pId)) {
        dualAthletesCount++;
      }
    }

    return {
      uniqueActivePeople: allUniquePersonIds.size,
      totalActiveMemberships: studentMemberships.length + playerMemberships.length,
      activeStudents: studentMemberships.length,
      activePlayers: playerMemberships.length,
      dualAthletesCount,
    };
  }

  async getCoursesOccupancyMetrics(): Promise<DashboardCoursesOccupancyDto> {
    const now = new Date();
    const validOccupancyCondition = buildValidOccupancyCondition();

    const activeCourseSeasons = await this.prisma.courseSeason.findMany({
      where: { status: StatusCourseSeason.ACTIVE },
      select: {
        id: true,
        course: {
          select: {
            name: true,
            school: {
              select: {
                discipline: { select: { name: true } },
              },
            },
          },
        },
        shifts: {
          select: {
            id: true,
            maxMembers: true,
            shift: { select: { name: true } },
          },
        },
      },
    });

    const occupancyAggregations = await this.prisma.cycleEnrollment.groupBy({
      by: ['courseSeasonShiftId'],
      where: {
        cycleStartDate: { lte: now },
        cycleEndDate: { gte: now },
        ...validOccupancyCondition,
      },
      _count: { _all: true },
    });

    const occupancyMap = new Map<string, number>();
    occupancyAggregations.forEach((agg) => {
      occupancyMap.set(agg.courseSeasonShiftId, agg._count._all);
    });

    const allShifts: DashboardShiftOccupancyItemDto[] = [];
    let totalCapacity = 0;
    let totalOccupied = 0;

    for (const cs of activeCourseSeasons) {
      for (const shift of cs.shifts) {
        const capacity = shift.maxMembers || 0;
        const occupied = occupancyMap.get(shift.id) || 0;
        const available = Math.max(0, capacity - occupied);
        const rate = capacity > 0 ? Number(((occupied / capacity) * 100).toFixed(2)) : 0;

        totalCapacity += capacity;
        totalOccupied += occupied;

        allShifts.push({
          courseSeasonId: cs.id,
          courseSeasonShiftId: shift.id,
          courseName: cs.course?.name || 'Curso',
          shiftName: shift.shift?.name || 'Turno',
          disciplineName: cs.course?.school?.discipline?.name,
          occupied,
          capacity,
          available,
          rate,
        });
      }
    }

    allShifts.sort((a, b) => b.rate - a.rate);

    return {
      totalCapacity,
      totalOccupied,
      globalRate: totalCapacity > 0 ? Number(((totalOccupied / totalCapacity) * 100).toFixed(2)) : 0,
      topOccupiedShifts: allShifts.slice(0, 5),
    };
  }

  async getSafeAlerts(
    userPermissions: string[],
    coursesOccupancy?: DashboardCoursesOccupancyDto,
    receivables?: DashboardReceivablesSummaryDto,
  ): Promise<DashboardAlertItemDto[]> {
    const alerts: DashboardAlertItemDto[] = [];
    const now = new Date();

    const canReadCourses =
      userPermissions.includes('READ_COURSE_SEASONS') ||
      userPermissions.includes('READ_SHIFTS');
    const canReadReceivables =
      userPermissions.includes('READ_CHARGES') ||
      userPermissions.includes('READ_ACCOUNT_CHARGES');

    // Alerta A: Turnos Saturados (FULL) - Reutiliza coursesOccupancy sin consultas duplicadas
    if (canReadCourses && coursesOccupancy) {
      const fullShifts = coursesOccupancy.topOccupiedShifts.filter(
        (s) => s.capacity > 0 && s.occupied >= s.capacity,
      );

      if (fullShifts.length > 0) {
        alerts.push({
          id: 'alert-full-shifts',
          type: 'FULL_SHIFT',
          severity: 'CRITICAL',
          title:
            fullShifts.length === 1
              ? 'Turno con cupo lleno'
              : `${fullShifts.length} turnos con cupos llenos`,
          description: fullShifts
            .map((s) => `${s.courseName} (${s.shiftName})`)
            .slice(0, 3)
            .join(', '),
          count: fullShifts.length,
          actionLabel: 'Gestionar cupos',
          actionUrl: '/admin/courses',
        });
      }
    }

    // Alerta B: Cartera Vencida (En mora) - Reutiliza receivables sin consultas duplicadas
    if (canReadReceivables && receivables) {
      if (receivables.overdueChargesCount > 0) {
        alerts.push({
          id: 'alert-overdue-receivables',
          type: 'OVERDUE_RECEIVABLES',
          severity: 'WARNING',
          title:
            receivables.overdueChargesCount === 1
              ? 'Cuenta por cobrar en mora'
              : `${receivables.overdueChargesCount} cuentas por cobrar en mora`,
          description: 'Cargos con fecha límite de pago superada',
          count: receivables.overdueChargesCount,
          actionLabel: 'Ver cuentas por cobrar',
          actionUrl: '/admin/accounting/receivables',
        });
      }
    }

    // Alerta C: Ciclo próximo a vencer (próximos 7 días)
    if (canReadCourses) {
      try {
        const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const expiringCount = await this.prisma.cycleEnrollment.count({
          where: {
            cycleEndDate: { gte: now, lte: inSevenDays },
            status: 'CONFIRMED',
          },
        });

        if (expiringCount > 0) {
          alerts.push({
            id: 'alert-expiring-cycles',
            type: 'EXPIRING_CYCLE',
            severity: 'INFO',
            title: expiringCount === 1 ? 'Matrícula por vencer' : `${expiringCount} matrículas vencen esta semana`,
            description: 'Ciclos académicos que finalizan en los próximos 7 días',
            count: expiringCount,
            actionLabel: 'Revisar inscripciones',
            actionUrl: '/admin/student-memberships',
          });
        }
      } catch (err) {
        this.logger.warn(`Error al verificar alerta de ciclos por vencer: ${err}`);
      }
    }

    return alerts;
  }

  private resolvePeriod(query: DashboardSummaryQueryDto): {
    periodStart: Date;
    periodEnd: Date;
    label: string;
  } {
    if (query.from && query.to) {
      const periodStart = DateUtils.getStartOfLocalDayInUTC(query.from);
      const periodEnd = DateUtils.getEndOfLocalDayInUTC(query.to);
      const label = `${DateUtils.formatLocalDate(periodStart)} - ${DateUtils.formatLocalDate(periodEnd)}`;
      return { periodStart, periodEnd, label };
    }

    // Default al mes calendario local actual en envs.appTimezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: envs.appTimezone,
      year: 'numeric',
      month: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const year = parseInt(parts.find((p) => p.type === 'year')!.value);
    const month = parseInt(parts.find((p) => p.type === 'month')!.value);

    const { startDate, endDate } = DateUtils.getMonthBoundariesInUTC(year, month);
    // Para que sea inclusivo el fin de mes:
    const periodEnd = new Date(endDate.getTime() - 1);

    const labelFormatter = new Intl.DateTimeFormat('es-BO', {
      timeZone: envs.appTimezone,
      month: 'long',
      year: 'numeric',
    });
    const monthName = labelFormatter.format(now);
    const capitalizedLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return {
      periodStart: startDate,
      periodEnd,
      label: capitalizedLabel,
    };
  }
}
