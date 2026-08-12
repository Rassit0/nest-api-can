import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary() {
    const [
      counters,
      financialSummary,
      revenueSummary,
      membershipGrowth,
      membershipDistribution,
      upcomingRenewals,
      upcomingCharges,
      recentPayments,
      topDebtors,
      alerts,
    ] = await Promise.all([
      this.getMembershipCounters(),
      this.getFinancialSummary(),
      this.getRevenueSummary(),
      this.getMembershipGrowth(),
      this.getMembershipDistribution(),
      this.getUpcomingRenewals(),
      this.getUpcomingCharges(),
      this.getRecentPayments(),
      this.getTopDebtors(),
      this.getMembershipAlerts(),
    ]);

    return {
      counters,
      financialSummary,
      revenueSummary,
      membershipGrowth,
      membershipDistribution,
      upcomingRenewals,
      upcomingCharges,
      recentPayments,
      topDebtors,
      alerts,
    };
  }

  private async getMembershipCounters() {
    const [
      activePlayers,
      suspendedPlayers,
      activeStudents,
      suspendedStudents,
      totalPlayers,
      totalStudents,
    ] = await Promise.all([
      this.prisma.playerMembership.count({ where: { status: 'ACTIVE' } }),
      this.prisma.playerMembership.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.studentMembership.count({ where: { status: 'ACTIVE' } }),
      this.prisma.studentMembership.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.playerMembership.count({ where: { status: { not: 'FINISHED' } } }),
      this.prisma.studentMembership.count({ where: { status: { not: 'FINISHED' } } }),
    ]);

    return {
      active: activePlayers + activeStudents,
      suspended: suspendedPlayers + suspendedStudents,
      total: totalPlayers + totalStudents,
      studentsActive: activeStudents,
      playersActive: activePlayers,
    };
  }

  private async getFinancialSummary() {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendingCharges, monthIncome] = await Promise.all([
      this.prisma.charge.aggregate({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] },
          OR: [
            { membershipCharges: { some: {} } },
            { studentCharges: { some: {} } },
          ],
        },
        _sum: { pendingAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          type: 'INCOME',
          transactionDate: { gte: firstDayOfMonth },
          payment: {
            charge: {
              OR: [
                { membershipCharges: { some: {} } },
                { studentCharges: { some: {} } },
              ],
            },
          },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalPendingDebt: Number(pendingCharges._sum.pendingAmount || 0),
      collectedThisMonth: Number(monthIncome._sum.amount || 0),
    };
  }

  private async getRevenueSummary() {
    const months = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59,
      );
      months.push({
        start,
        end,
        label: start.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
      });
    }

    const revenuePromises = months.map((m) =>
      this.prisma.transaction.aggregate({
        where: {
          status: 'COMPLETED',
          type: 'INCOME',
          transactionDate: { gte: m.start, lte: m.end },
          payment: {
            charge: {
              OR: [
                { membershipCharges: { some: {} } },
                { studentCharges: { some: {} } },
              ],
            },
          },
        },
        _sum: { amount: true },
      }),
    );

    const debtPromises = months.map((m) =>
      this.prisma.charge.aggregate({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] },
          createdAt: { gte: m.start, lte: m.end },
          OR: [
            { membershipCharges: { some: {} } },
            { studentCharges: { some: {} } },
          ],
        },
        _sum: { pendingAmount: true },
      }),
    );

    const revenueResults = await Promise.all(revenuePromises);
    const debtResults = await Promise.all(debtPromises);

    return months.map((m, index) => ({
      name: m.label,
      ingresos: Number(revenueResults[index]._sum.amount || 0),
      deuda: Number(debtResults[index]._sum.pendingAmount || 0),
    }));
  }

  private async getMembershipGrowth() {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    const [
      playersThisMonth,
      studentsThisMonth,
      playersLastMonth,
      studentsLastMonth,
    ] = await Promise.all([
      this.prisma.playerMembership.count({
        where: { startedAt: { gte: firstDayThisMonth } },
      }),
      this.prisma.studentMembership.count({
        where: { startedAt: { gte: firstDayThisMonth } },
      }),
      this.prisma.playerMembership.count({
        where: {
          startedAt: { gte: firstDayLastMonth, lt: firstDayThisMonth },
        },
      }),
      this.prisma.studentMembership.count({
        where: {
          startedAt: { gte: firstDayLastMonth, lt: firstDayThisMonth },
        },
      }),
    ]);

    const currentMonth = playersThisMonth + studentsThisMonth;
    const previousMonth = playersLastMonth + studentsLastMonth;
    const growth =
      previousMonth === 0
        ? 100
        : ((currentMonth - previousMonth) / previousMonth) * 100;

    return {
      newThisMonth: currentMonth,
      growthPercentage: Number(growth.toFixed(2)),
    };
  }

  private async getMembershipDistribution() {
    const playersByStatus = await this.prisma.playerMembership.groupBy({
      by: ['status'],
      _count: true,
    });

    const studentsByStatus = await this.prisma.studentMembership.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusMap = new Map();
    playersByStatus.forEach((p) =>
      statusMap.set(p.status, (statusMap.get(p.status) || 0) + p._count),
    );
    studentsByStatus.forEach((s) =>
      statusMap.set(s.status, (statusMap.get(s.status) || 0) + s._count),
    );

    return {
      byStatus: Array.from(statusMap.entries()).map(([name, value]) => ({
        name,
        value,
      })),
    };
  }

  private async getUpcomingRenewals() {
    const now = new Date();
    const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

    const [players, students] = await Promise.all([
      this.prisma.playerMembership.findMany({
        where: {
          endedAt: { not: null, gte: now, lte: next15Days },
          status: 'ACTIVE',
        },
        include: {
          player: { include: { person: true } },
          teamSeason: { include: { team: true, category: true } },
        },
        take: 5,
        orderBy: { endedAt: 'asc' },
      }),
      this.prisma.studentMembership.findMany({
        where: {
          endedAt: { not: null, gte: now, lte: next15Days },
          status: 'ACTIVE',
        },
        include: {
          student: { include: { person: true } },
          courseSeason: { include: { course: true, category: true } },
        },
        take: 5,
        orderBy: { endedAt: 'asc' },
      }),
    ]);

    return [
      ...players.map((p) => ({
        id: p.id,
        type: 'Jugador',
        name: `${p.player.person.name} ${p.player.person.lastName}`,
        program: `${p.teamSeason.team.name} - ${p.teamSeason.category.name}`,
        endedAt: p.endedAt,
      })),
      ...students.map((s) => ({
        id: s.id,
        type: 'Estudiante',
        name: `${s.student.person.name} ${s.student.person.lastName}`,
        program: `${s.courseSeason.course.name} - ${s.courseSeason.category.name}`,
        endedAt: s.endedAt,
      })),
    ]
      .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime())
      .slice(0, 5);
  }

  private async getUpcomingCharges() {
    const now = new Date();

    const charges = await this.prisma.charge.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { gte: now },
        OR: [
          { membershipCharges: { some: {} } },
          { studentCharges: { some: {} } },
        ],
      },
      include: {
        membershipCharges: {
          include: {
            playerMembership: {
              include: { player: { include: { person: true } } },
            },
          },
        },
        studentCharges: {
          include: {
            studentMembership: {
              include: { student: { include: { person: true } } },
            },
          },
        },
      },
      take: 5,
      orderBy: { dueDate: 'asc' },
    });

    return charges.map((c) => {
      let person = null;
      let type = '';
      if (c.membershipCharges.length > 0) {
        person = c.membershipCharges[0].playerMembership.player.person;
        type = 'Jugador';
      } else if (c.studentCharges.length > 0) {
        person = c.studentCharges[0].studentMembership.student.person;
        type = 'Estudiante';
      }
      return {
        id: c.id,
        amount: Number(c.amount),
        dueDate: c.dueDate,
        personName: person ? `${person.name} ${person.lastName}` : 'Desconocido',
        type,
      };
    });
  }

  private async getRecentPayments() {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: 'COMPLETED',
        type: 'INCOME',
        payment: {
          charge: {
            OR: [
              { membershipCharges: { some: {} } },
              { studentCharges: { some: {} } },
            ],
          },
        },
      },
      include: {
        payerPerson: true,
      },
      take: 5,
      orderBy: { transactionDate: 'desc' },
    });

    return transactions.map((t) => ({
      id: t.id,
      amount: Number(t.amount),
      date: t.transactionDate,
      payerName: t.payerPerson
        ? `${t.payerPerson.name} ${t.payerPerson.lastName}`
        : 'Desconocido',
      method: t.paymentMethod,
    }));
  }

  private async getTopDebtors() {
    const topCharges = await this.prisma.charge.findMany({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: new Date() },
        OR: [
          { membershipCharges: { some: {} } },
          { studentCharges: { some: {} } },
        ],
      },
      include: {
        membershipCharges: {
          include: {
            playerMembership: {
              include: { player: { include: { person: true } } },
            },
          },
        },
        studentCharges: {
          include: {
            studentMembership: {
              include: { student: { include: { person: true } } },
            },
          },
        },
      },
      take: 5,
      orderBy: { pendingAmount: 'desc' },
    });

    return topCharges.map((c) => {
      let person = null;
      let type = '';
      if (c.membershipCharges.length > 0) {
        person = c.membershipCharges[0].playerMembership.player.person;
        type = 'Jugador';
      } else if (c.studentCharges.length > 0) {
        person = c.studentCharges[0].studentMembership.student.person;
        type = 'Estudiante';
      }
      return {
        id: c.id,
        debt: Number(c.pendingAmount),
        dueDate: c.dueDate,
        personName: person ? `${person.name} ${person.lastName}` : 'Desconocido',
        type,
        phone: person?.phone || 'Sin número',
      };
    });
  }

  private async getMembershipAlerts() {
    const totalOverdue = await this.prisma.charge.count({
      where: {
        status: { in: ['PENDING', 'PARTIAL'] },
        dueDate: { lt: new Date() },
        OR: [
          { membershipCharges: { some: {} } },
          { studentCharges: { some: {} } },
        ],
      },
    });

    const pendingRenewals = await this.prisma.playerMembership.count({
      where: {
        endedAt: {
          lte: new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000),
        },
        status: 'ACTIVE',
      },
    });

    return [
      {
        id: '1',
        title: 'Cargos Atrasados',
        description: `Hay ${totalOverdue} cargos vencidos que requieren seguimiento.`,
        type: 'warning',
      },
      {
        id: '2',
        title: 'Renovaciones Próximas',
        description: `Hay ${pendingRenewals} membresías a punto de vencer.`,
        type: 'info',
      },
    ].filter((a) => !a.description.includes('Hay 0 '));
  }
}
