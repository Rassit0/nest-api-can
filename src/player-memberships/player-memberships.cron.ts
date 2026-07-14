import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus } from 'src/generated/prisma/client';

@Injectable()
export class PlayerMembershipsCron {
  private readonly logger = new Logger(PlayerMembershipsCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMembershipPauses() {
    this.logger.log('Verificando pausas de membresías de jugadores...');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. Activar pausas (individuales o de equipo) que comienzan hoy o antes y que la membresía sigue activa
    const membershipsToSuspend = await this.prisma.playerMembership.findMany({
      where: {
        status: PlayerMembershipStatus.ACTIVE,
        OR: [
          {
            pauses: {
              some: { startDate: { lte: today }, endDate: { gte: today } },
            },
          },
          {
            teamSeason: {
              teamSeasonPauses: {
                some: { startDate: { lte: today }, endDate: { gte: today } },
              },
            },
          },
        ],
      },
    });

    for (const membership of membershipsToSuspend) {
      await this.prisma.playerMembership.update({
        where: { id: membership.id },
        data: {
          status: PlayerMembershipStatus.SUSPENDED,
          notes: 'Suspendida automáticamente por pausa programada',
          histories: {
            create: {
              previousStatus: membership.status,
              newStatus: PlayerMembershipStatus.SUSPENDED,
              reason: 'Inicio de pausa programada',
            },
          },
        },
      });
      this.logger.log(`Membresía ${membership.id} suspendida por pausa.`);
    }

    // 2. Reactivar pausas que terminan hoy (o terminaron ayer y hoy deben estar activas)
    // Para no reactivar a alguien suspendido manualmente o por deudas, verificamos que una de sus pausas
    // haya terminado ayer y que NO tenga otra pausa activa actual.
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const membershipsToActivate = await this.prisma.playerMembership.findMany({
      where: {
        status: PlayerMembershipStatus.SUSPENDED,
        OR: [
          {
            pauses: {
              some: { endDate: { lt: today, gte: yesterday } },
            },
          },
          {
            teamSeason: {
              teamSeasonPauses: {
                some: { endDate: { lt: today, gte: yesterday } },
              },
            },
          },
        ],
        pauses: {
          none: { startDate: { lte: today }, endDate: { gte: today } },
        },
        teamSeason: {
          teamSeasonPauses: {
            none: { startDate: { lte: today }, endDate: { gte: today } },
          },
        },
      },
    });

    for (const membership of membershipsToActivate) {
      await this.prisma.playerMembership.update({
        where: { id: membership.id },
        data: {
          status: PlayerMembershipStatus.ACTIVE,
          notes: 'Reactivada automáticamente tras fin de pausa programada',
          histories: {
            create: {
              previousStatus: membership.status,
              newStatus: PlayerMembershipStatus.ACTIVE,
              reason: 'Fin de pausa programada',
            },
          },
        },
      });
      this.logger.log(`Membresía ${membership.id} reactivada tras pausa.`);
    }
  }
}
