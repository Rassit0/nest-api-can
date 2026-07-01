import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  PlayerMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

type ChargeWithRelations = Prisma.ChargeGetPayload<{
  include: {
    membershipCharges: {
      include: {
        playerMembership: {
          include: {
            teamSeason: true;
          };
        };
      };
    };
  };
}>;

const chargeInclude = {
  // Viajamos a través de la relación para obtener la configuración de la temporada
  membershipCharges: {
    include: {
      playerMembership: {
        include: {
          teamSeason: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class MembershipLateFeeService {
  private readonly logger = new Logger(MembershipLateFeeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Proceso principal para aplicar recargos a todos los cargos vencidos en el sistema.
   * Este método puede ser llamado por un Cron Job todas las noches.
   */
  async applyDailyLateFees() {
    this.logger.log('Iniciando proceso diario de cálculo de recargos...');

    // Obtener la fecha actual
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar todos los cargos PENDING que ya vencieron (dueDate < hoy)
    //    y que NO sean cargos hijos (parentChargeId: null)
    const overdueCharges = await this.prisma.charge.findMany({
      where: {
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.MONTHLY_FEE,
            playerMembership: {
              status: {
                in: [
                  PlayerMembershipStatus.ACTIVE,
                  PlayerMembershipStatus.PENDING_ACTIVE,
                  PlayerMembershipStatus.SUSPENDED,
                ],
              },
            },
          },
        },
        parentChargeId: null,
        dueDate: {
          lt: today,
        },
      },
      include: chargeInclude,
    });

    this.logger.log(
      `Se encontraron ${overdueCharges.length} cargos vencidos base.`,
    );

    // 2. Iterar en una transacción o de manera controlada por cada cargo vencido
    for (const baseCharge of overdueCharges) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.processChargeLateFee(tx, baseCharge, today);
        });
      } catch (error) {
        this.logger.error(
          `Error procesando recargos para el cargo ID ${baseCharge.id}:`,
          error,
        );
      }
    }

    this.logger.log('Proceso de recargos finalizado.');
  }

  /**
   * Lógica interna para evaluar y aplicar la mora a un cargo individual
   */
  private async processChargeLateFee(
    tx: Prisma.TransactionClient,
    baseCharge: ChargeWithRelations,
    today: Date,
  ) {
    // Buscar la relación con la membresía (asumimos un cargo ligado a MembershipCharge)
    const membershipChargeRelation = baseCharge.membershipCharges[0];
    if (!membershipChargeRelation) return;

    const teamSeason = membershipChargeRelation.playerMembership?.teamSeason;
    if (!teamSeason) return;

    // 1. Verificar si los recargos están habilitados en la temporada
    if (!teamSeason.lateFeeEnabled) return;

    // Fecha de vencimiento del cargo
    const dueDate = new Date(baseCharge.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    // 2. Calcular los días exactos de vencimiento (con protección a recortes de DST usando round)
    const elapsedDays = this.calculateElapsedDays(dueDate, today);

    const graceDays = Number(teamSeason.graceDays || 0);

    // 3. Verificar si se encuentra dentro de los días de gracia (tolerancia)
    if (elapsedDays <= graceDays) return;

    // 4. Calcular los días reales de penalización y el monto de mora acumulado hoy
    const penaltyDays = elapsedDays - graceDays;
    // Obtener el valor del recargo por día
    const lateFeePerDay = Number(teamSeason.lateFeePerDay || 0);
    // Calcular el monto total del recargo
    const targetLateFeeAmount = penaltyDays * lateFeePerDay;

    // Si el monto del recargo es 0, no hacer nada
    if (targetLateFeeAmount <= 0) return;

    // 5. Buscar si ya existe un cargo hijo destinado al recargo
    // Identificable por el tipo de cargo de membresia
    const existingLateFeeCharge = await tx.charge.findFirst({
      where: {
        parentChargeId: baseCharge.id,
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });

    if (existingLateFeeCharge) {
      // Si sigue PENDING o PARTIAL, actualizamos su valor al nuevo acumulado del día de hoy.
      if (
        existingLateFeeCharge.status === StatusCharge.PENDING ||
        existingLateFeeCharge.status === StatusCharge.PARTIAL ||
        existingLateFeeCharge.status === StatusCharge.PAID
      ) {
        // Monto anterior del recargo
        const previousAmount = Number(existingLateFeeCharge.amount);
        // Diferencia entre el monto actual y el anterior
        const difference = targetLateFeeAmount - previousAmount;

        // Si hay diferencia positiva, actualizamos el cargo de mora hijo
        if (difference > 0) {
          // Actualizamos el cargo de mora hijo
          await tx.charge.update({
            where: { id: existingLateFeeCharge.id },
            data: {
              amount: targetLateFeeAmount,
              pendingAmount:
                Number(existingLateFeeCharge.pendingAmount) + difference,
              status:
                existingLateFeeCharge.status === StatusCharge.PAID
                  ? StatusCharge.PARTIAL
                  : existingLateFeeCharge.status,
              description: `Recargo por Mora - ${penaltyDays} x ${lateFeePerDay}/día`,
            },
          });
        }
      }
    } else {
      // 6. Si no existe un cargo de mora previo, creamos el cargo hijo desde cero
      await tx.charge.create({
        data: {
          parentChargeId: baseCharge.id,
          description: `Recargo por Mora - ${penaltyDays} días de retraso`,
          amount: targetLateFeeAmount,
          pendingAmount: targetLateFeeAmount,
          dueDate: today, // El recargo nace hoy
          status: StatusCharge.PENDING,
          membershipCharges: {
            create: {
              type: TypeMembershipCharge.LATE_FEE,
              playerMembershipId: membershipChargeRelation.playerMembershipId,
              createdByCron: true,
            },
          },
        },
      });
    }
  }
  private calculateElapsedDays(dueDate: Date, today: Date) {
    // Calculamos los días exactos redondeados para evitar inexactitudes por cambios de horario de verano (DST)
    const diffTime = today.getTime() - dueDate.getTime();
    // Convertimos la diferencia de milisegundos a días
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }
}
