import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipStatus } from 'src/generated/prisma/client';

@Injectable()
export class StudentMembershipsCron {
  private readonly logger = new Logger(StudentMembershipsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMembershipPauses() {
    this.logger.log('Verificando pausas de membresías de estudiantes...');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. Activar pausas (individuales o de grupo) que comienzan hoy o antes y que la membresía sigue activa
    const membershipsToSuspend = await this.prisma.studentMembership.findMany({
      where: {
        status: StudentMembershipStatus.ACTIVE,
        OR: [
          {
            pauses: {
              some: { startDate: { lte: today }, endDate: { gte: today } },
            },
          },
          {
            courseSeason: {
              pauses: {
                some: { startDate: { lte: today }, endDate: { gte: today } },
              },
            },
          },
        ],
      },
    });

    for (const membership of membershipsToSuspend) {
      await this.prisma.studentMembership.update({
        where: { id: membership.id },
        data: {
          status: StudentMembershipStatus.SUSPENDED,
          notes: 'Suspendida automáticamente por pausa programada',
        },
      });
      this.logger.log(`Membresía ${membership.id} suspendida por pausa.`);
    }

    // 2. Reactivar pausas que terminan hoy (o terminaron ayer y hoy deben estar activas)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const membershipsToActivate = await this.prisma.studentMembership.findMany({
      where: {
        status: StudentMembershipStatus.SUSPENDED,
        OR: [
          {
            pauses: {
              some: { endDate: { lt: today, gte: yesterday } },
            },
          },
          {
            courseSeason: {
              pauses: {
                some: { endDate: { lt: today, gte: yesterday } },
              },
            },
          },
        ],
        pauses: {
          none: { startDate: { lte: today }, endDate: { gte: today } },
        },
        courseSeason: {
          pauses: {
            none: { startDate: { lte: today }, endDate: { gte: today } },
          },
        },
      },
    });

    for (const membership of membershipsToActivate) {
      await this.prisma.studentMembership.update({
        where: { id: membership.id },
        data: {
          status: StudentMembershipStatus.ACTIVE,
          notes: 'Reactivada automáticamente tras fin de pausa programada',
        },
      });
      this.logger.log(`Membresía ${membership.id} reactivada tras pausa.`);
    }
  }
}
