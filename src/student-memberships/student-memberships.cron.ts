import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { envs } from '../config/envs';
import { StudentMembershipStatus, CycleEnrollmentStatus, StudentMembershipSuspensionReason } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ChargesService } from 'src/charges/charges.service';
import { PAYMENT_DEADLINE_HOURS } from 'src/common/helpers/cycle-enrollment.helper';
import { StatusCharge } from 'src/generated/prisma/client';
import { StudentMembershipsService } from './student-memberships.service';

@Injectable()
export class StudentMembershipsCron {
  private readonly logger = new Logger(StudentMembershipsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chargesService: ChargesService,
    private readonly studentMembershipsService: StudentMembershipsService,
  ) {}

  @Cron('30 0 * * *', {
    timeZone: envs.appTimezone,
  })
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
          suspensionReason: StudentMembershipSuspensionReason.PAUSE,
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
        suspensionReason: StudentMembershipSuspensionReason.PAUSE,
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
      try {
        const result = await this.prisma.studentMembership.updateMany({
          where: { 
            id: membership.id,
            status: StudentMembershipStatus.SUSPENDED,
            suspensionReason: StudentMembershipSuspensionReason.PAUSE,
          },
          data: {
            status: StudentMembershipStatus.ACTIVE,
            suspensionReason: null,
            notes: 'Reactivada automáticamente tras fin de pausa programada',
          },
        });
        
        if (result.count > 0) {
          this.logger.log(`Membresía ${membership.id} reactivada tras pausa.`);
        }
      } catch (error) {
        this.logger.error(`Error reactivando membresía ${membership.id} tras pausa: ${error.message}`);
      }
    }
  }

  // Ejecutar cada hora para verificar expiraciones (o cada 15 min según necesidad)
  @Cron('0 * * * *', {
    timeZone: envs.appTimezone,
  })
  async processExpiredPendingCycles() {
    this.logger.log('Verificando expiración de reservas de ciclos PENDING...');

    const threshold = new Date(Date.now() - (PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000));

    // Buscar ciclos que estén PENDING y hayan sido creados ANTES del threshold
    const expiredEnrollments = await this.prisma.cycleEnrollment.findMany({
      where: {
        status: CycleEnrollmentStatus.PENDING,
        createdAt: { lte: threshold },
      },
      select: {
        id: true,
        chargeId: true,
      }
    });

    for (const enrollment of expiredEnrollments) {
      try {
        await this.studentMembershipsService.cancelExpiredPendingCycle(enrollment.id);
        this.logger.log(`Reserva ${enrollment.id} expirada tras 24h verificada y cancelada automáticamente (si aplicaba).`);
      } catch (error) {
        if (error.code === 'P2034') {
          // Serialization failure, another process handled it
          this.logger.log(`Conflicto transaccional al cancelar reserva ${enrollment.id} (P2034). Reintentará luego si sigue PENDING.`);
        } else {
          this.logger.error(`Error cancelando reserva expirada ${enrollment.id}: ${error.message}`);
        }
      }
    }
  }
}
