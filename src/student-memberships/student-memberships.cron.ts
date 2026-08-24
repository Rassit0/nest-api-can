import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { envs } from '../config/envs';
import { StudentMembershipStatus, CycleEnrollmentStatus, StudentMembershipSuspensionReason } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ChargesService } from 'src/charges/charges.service';
import { PAYMENT_DEADLINE_HOURS } from 'src/common/helpers/cycle-enrollment.helper';
import { StatusCharge } from 'src/generated/prisma/client';

@Injectable()
export class StudentMembershipsCron {
  private readonly logger = new Logger(StudentMembershipsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chargesService: ChargesService,
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
        // Verificar que siga estando PENDING justo antes de procesar (Idempotencia)
        const currentCycle = await this.prisma.cycleEnrollment.findUnique({
          where: { id: enrollment.id },
          select: { status: true },
        });

        if (currentCycle?.status !== CycleEnrollmentStatus.PENDING) {
          continue;
        }

        if (enrollment.chargeId) {
          // El servicio chargesService.update({status: CANCELLED}) ya maneja
          // transaccionalmente la cancelación del charge y usa syncCycleEnrollmentStatus
          // para propagar el status CANCELLED al CycleEnrollment.
          await this.chargesService.update(enrollment.chargeId, {
            status: StatusCharge.CANCELLED
          });
          this.logger.log(`Reserva ${enrollment.id} expirada tras 24h. Cargo ${enrollment.chargeId} cancelado automáticamente.`);
        } else {
          // Fallback por si no tiene cargo (raro, pero posible en datos inconsistentes)
          await this.prisma.cycleEnrollment.update({
            where: { id: enrollment.id },
            data: { status: CycleEnrollmentStatus.CANCELLED },
          });
          this.logger.log(`Reserva ${enrollment.id} expirada tras 24h (sin cargo asociado). Cancelada automáticamente.`);
        }
      } catch (error) {
        this.logger.error(`Error cancelando reserva expirada ${enrollment.id}: ${error.message}`);
      }
    }
  }
}
