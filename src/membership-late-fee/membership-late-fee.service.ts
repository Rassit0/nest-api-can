import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { LateFeeRepository, ChargeWithLateFeeRelations } from './repositories/late-fee.repository';

@Injectable()
export class MembershipLateFeeService {
  private readonly logger = new Logger(MembershipLateFeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lateFeeRepo: LateFeeRepository,
  ) {}

  /**
   * Proceso principal para aplicar recargos a todos los cargos vencidos en el sistema.
   * Este método puede ser llamado por un Cron Job todas las noches.
   */
  async applyDailyLateFees() {
    this.logger.log('Iniciando proceso diario de cálculo de recargos...');

    const evaluationDate = DateUtils.getStartOfUTCDay(new Date());

    const overdueCharges = await this.lateFeeRepo.findOverdueCharges(evaluationDate);

    this.logger.log(
      `Se encontraron ${overdueCharges.length} cargos vencidos base.`,
    );

    const chunkSize = 50;
    for (let i = 0; i < overdueCharges.length; i += chunkSize) {
      const chunk = overdueCharges.slice(i, i + chunkSize);
      
      await Promise.all(
        chunk.map(async (baseCharge) => {
          try {
            await this.prisma.$transaction(async (tx) => {
              await this.processChargeLateFee(tx, baseCharge, evaluationDate);
            });
          } catch (error) {
            this.logger.error(
              `Error procesando recargos para el cargo ID ${baseCharge.id}:`,
              error,
            );
          }
        })
      );
    }

    this.logger.log('Proceso de recargos finalizado.');
  }

  /**
   * Lógica interna para evaluar y aplicar la mora a un cargo individual
   */
  private async processChargeLateFee(
    tx: Prisma.TransactionClient,
    baseCharge: ChargeWithLateFeeRelations,
    evaluationDate: Date,
  ) {
    const membershipChargeRelation = baseCharge.membershipCharges[0];
    if (!membershipChargeRelation) return;

    const teamSeason = membershipChargeRelation.playerMembership?.teamSeason;
    if (!teamSeason || !teamSeason.billingConfig?.lateFeeEnabled || teamSeason.billingConfig?.isEngineActive === false) return;

    const dueDate = DateUtils.getStartOfUTCDay(baseCharge.dueDate);

    
    const teamSeasonPauses = teamSeason.teamSeasonPauses || [];
    let pausedDays = 0;

    for (const p of teamSeasonPauses) {
      if (p.startDate > evaluationDate || p.endDate < dueDate) continue;

      const pauseStart = p.startDate < dueDate ? dueDate : p.startDate;
      const pauseEnd = p.endDate > evaluationDate ? evaluationDate : p.endDate;

      if (pauseStart <= pauseEnd) {
        pausedDays += this.calculateElapsedDays(pauseStart, pauseEnd);
      }
    }

    const elapsedDays = this.calculateElapsedDays(dueDate, evaluationDate) - pausedDays;

    const graceDays = Number(teamSeason.billingConfig?.graceDays || 0);

    if (elapsedDays <= graceDays) return;

    const penaltyDays = elapsedDays - graceDays;
    const lateFeePerDay = Number(teamSeason.billingConfig?.lateFeePerDay || 0);
    const targetLateFeeAmount = penaltyDays * lateFeePerDay;

    if (targetLateFeeAmount <= 0) return;

    const existingLateFeeCharge = await this.lateFeeRepo.findExistingLateFeeCharge(tx, baseCharge.id);

    if (existingLateFeeCharge) {
      if (
        existingLateFeeCharge.status === StatusCharge.PENDING ||
        existingLateFeeCharge.status === StatusCharge.PARTIAL ||
        existingLateFeeCharge.status === StatusCharge.PAID
      ) {
        const previousAmount = Number(existingLateFeeCharge.amount);
        const difference = targetLateFeeAmount - previousAmount;

        if (difference > 0) {
          await this.lateFeeRepo.updateLateFeeCharge(tx, existingLateFeeCharge.id, {
            amount: targetLateFeeAmount,
            pendingAmount: Number(existingLateFeeCharge.pendingAmount) + difference,
            status:
              existingLateFeeCharge.status === StatusCharge.PAID
                ? StatusCharge.PARTIAL
                : existingLateFeeCharge.status,
            description: `Recargo por Mora - ${penaltyDays} x ${lateFeePerDay}/día`,
          });
        }
      }
    } else {
      await this.lateFeeRepo.createLateFeeCharge(tx, {
        parentChargeId: baseCharge.id,
        description: `Recargo por Mora - ${penaltyDays} días de retraso`,
        amount: targetLateFeeAmount,
        pendingAmount: targetLateFeeAmount,
        dueDate: evaluationDate,
        status: StatusCharge.PENDING,
        membershipCharges: {
          create: {
            type: TypeMembershipCharge.LATE_FEE,
            playerMembershipId: membershipChargeRelation.playerMembershipId,
            createdByCron: true,
          },
        },
      });
    }
  }

  private calculateElapsedDays(dueDate: Date, evaluationDate: Date) {
    const diffTime = evaluationDate.getTime() - dueDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }
}
