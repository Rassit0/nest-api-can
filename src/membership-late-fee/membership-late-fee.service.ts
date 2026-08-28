import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import {
  LateFeeRepository,
  ChargeWithLateFeeRelations,
} from './repositories/late-fee.repository';

@Injectable()
export class MembershipLateFeeService {
  private readonly logger = new Logger(MembershipLateFeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lateFeeRepo: LateFeeRepository,
  ) {}

  /**
   * Proceso principal para aplicar recargos a todos los cargos vencidos en el sistema.
   * Este mÃ©todo puede ser llamado por un Cron Job todas las noches.
   */
  async applyDailyLateFees() {
    this.logger.log('Iniciando proceso diario de cÃ¡lculo de recargos...');

    const evaluationDate = DateUtils.getEndOfLocalDayInUTC(new Date());

    const overdueCharges =
      await this.lateFeeRepo.findOverdueCharges(evaluationDate);

    this.logger.log(
      `Se encontraron ${overdueCharges.length} cargos vencidos base.`,
    );

    const chunkSize = 50;
    for (let i = 0; i < overdueCharges.length; i += chunkSize) {
      const chunk = overdueCharges.slice(i, i + chunkSize);

      for (const baseCharge of chunk) {
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
      }
    }

    this.logger.log('Proceso de recargos finalizado.');
  }

  /**
   * LÃ³gica interna para evaluar y aplicar la mora a un cargo individual (CRON)
   */
  private async processChargeLateFee(
    tx: Prisma.TransactionClient,
    baseCharge: ChargeWithLateFeeRelations,
    evaluationDate: Date,
  ) {
    const preview = this.calculateLateFee(baseCharge, evaluationDate);
    if (preview.totalLateFeeAmount <= 0) return;

    const existingLateFeeCharge = await this.lateFeeRepo.findExistingLateFeeCharge(tx, baseCharge.id);

    if (existingLateFeeCharge) {
      if (
        existingLateFeeCharge.status === StatusCharge.PENDING ||
        existingLateFeeCharge.status === StatusCharge.PARTIAL ||
        existingLateFeeCharge.status === StatusCharge.PAID
      ) {
        const previousAmount = Number(existingLateFeeCharge.amount);
        const difference = preview.totalLateFeeAmount - previousAmount;

        if (difference > 0) {
          await this.lateFeeRepo.updateLateFeeCharge(
            tx,
            existingLateFeeCharge.id,
            {
              amount: preview.totalLateFeeAmount,
              pendingAmount: Number(existingLateFeeCharge.pendingAmount) + difference,
              status:
                existingLateFeeCharge.status === StatusCharge.PAID
                  ? StatusCharge.PARTIAL
                  : existingLateFeeCharge.status,
              description: `Recargo por Mora - ${preview.penaltyDays} x ${preview.lateFeePerDay}/dÃ­a`,
            },
          );
        }
      }
    } else {
      const membershipChargeRelation = baseCharge.membershipCharges[0];
      await this.lateFeeRepo.createLateFeeCharge(tx, {
        parentChargeId: baseCharge.id,
        chargeCategory: 'LATE_FEE',
        description: `Recargo por Mora - ${preview.penaltyDays} dÃ­as de retraso`,
        amount: preview.totalLateFeeAmount,
        pendingAmount: preview.totalLateFeeAmount,
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

  /**
   * Genera una previsualizaciÃ³n matemÃ¡tica de la mora actual sin persistirla.
   */
  async previewLateFee(chargeId: string) {
    const baseCharge = await this.lateFeeRepo.findChargeForLateFee(chargeId);
    if (!baseCharge) {
      throw new NotFoundException('Cargo no encontrado o no pertenece a un CourseSeason.');
    }
    
    if (baseCharge.status === StatusCharge.CANCELLED) {
    
      throw new BadRequestException('No se puede generar mora sobre un cargo anulado.');
    
    }
    
    // Validar que el cargo base no sea ya una mora
    if (baseCharge.membershipCharges?.[0]?.type === TypeMembershipCharge.LATE_FEE) {
      throw new BadRequestException('El cargo seleccionado ya es un recargo por mora.');
    }

    const evaluationDate = DateUtils.getEndOfLocalDayInUTC(new Date());
    const preview = this.calculateLateFee(baseCharge, evaluationDate);
    
    if (preview.totalLateFeeAmount <= 0) {
      throw new BadRequestException('No hay recargo aplicable en este momento (periodo de gracia activo o cargo no vencido).');
    }

    const existingLateFee = await this.lateFeeRepo.findPendingLateFeeCharge(this.prisma, chargeId);

    return {
      chargeId: baseCharge.id,
      dueDate: baseCharge.dueDate,
      daysPassed: preview.elapsedDays,
      graceDays: Number(baseCharge.membershipCharges[0]?.playerMembership?.teamSeason?.billingConfig?.graceDays || 0),
      punishableDays: preview.penaltyDays,
      lateFeePerDay: preview.lateFeePerDay,
      totalLateFeeAmount: preview.totalLateFeeAmount,
      originalAmount: Number(baseCharge.amount),
      alreadyHasLateFee: !!existingLateFee,
    };
  }

  /**
   * Aplica un recargo por mora de forma manual (On Demand).
   */
  async applyLateFee(chargeId: string, customAmount?: number) {
    return await this.prisma.$transaction(async (tx) => {
      const baseCharge = await this.lateFeeRepo.findChargeForLateFee(chargeId, tx);
      if (!baseCharge) {
        throw new NotFoundException('Cargo no encontrado o no pertenece a un CourseSeason.');
      }

      if (baseCharge.status === StatusCharge.CANCELLED) {
        throw new BadRequestException('No se puede generar mora sobre un cargo anulado.');
      }

      if (baseCharge.membershipCharges?.[0]?.type === TypeMembershipCharge.LATE_FEE) {
        throw new BadRequestException('El cargo seleccionado ya es un recargo por mora.');
      }

      const evaluationDate = DateUtils.getEndOfLocalDayInUTC(new Date());
      const preview = this.calculateLateFee(baseCharge, evaluationDate);

      const finalAmount = customAmount !== undefined ? customAmount : preview.totalLateFeeAmount;

      if (finalAmount <= 0) {
        throw new BadRequestException('El monto de mora es 0 o menor.');
      }

      const existingLateFee = await this.lateFeeRepo.findPendingLateFeeCharge(tx, chargeId);
      if (existingLateFee) {
        throw new BadRequestException('Ya existe un recargo por mora pendiente de pago para este cargo. Cancele o pague el recargo actual antes de generar uno nuevo.');
      }

      const membershipChargeRelation = baseCharge.membershipCharges[0];
      
      const description = customAmount !== undefined 
        ? 'Mora por atraso (Monto Personalizado)' 
        : 'Mora por atraso';

      const newCharge = await this.lateFeeRepo.createLateFeeCharge(tx, {
        parentChargeId: baseCharge.id,
        chargeCategory: 'LATE_FEE',
        description,
        amount: finalAmount,
        pendingAmount: finalAmount,
        dueDate: new Date(),
        status: StatusCharge.PENDING,
        membershipCharges: {
          create: {
            type: TypeMembershipCharge.LATE_FEE,
            playerMembershipId: membershipChargeRelation.playerMembershipId,
            createdByCron: false,
          },
        },
      });

      return {
        message: 'Recargo por mora aplicado exitosamente.',
        data: newCharge,
      };
    });
  }

  /**
   * FunciÃ³n pura para calcular matemÃ¡ticamente la mora.
   */
  public calculateLateFee(
    baseCharge: ChargeWithLateFeeRelations,
    evaluationDate: Date = DateUtils.getEndOfLocalDayInUTC(new Date()),
  ) {
    const membershipChargeRelation = baseCharge.membershipCharges[0];
    if (!membershipChargeRelation) {
      return { baseChargeId: baseCharge.id, elapsedDays: 0, penaltyDays: 0, lateFeePerDay: 0, totalLateFeeAmount: 0 };
    }

    const teamSeason = membershipChargeRelation.playerMembership?.teamSeason;
    if (
      !teamSeason ||
      !teamSeason.billingConfig?.lateFeeEnabled ||
      teamSeason.billingConfig?.isEngineActive === false
    ) {
      return { baseChargeId: baseCharge.id, elapsedDays: 0, penaltyDays: 0, lateFeePerDay: 0, totalLateFeeAmount: 0 };
    }

    const dueDate = DateUtils.getEndOfLocalDayInUTC(baseCharge.dueDate);
    const teamSeasonPauses = teamSeason.teamSeasonPauses || [];
    const individualPauses = membershipChargeRelation.playerMembership?.pauses || [];
    const allPauses = [...teamSeasonPauses, ...individualPauses];
    let pausedDays = 0;

    if (allPauses.length > 0) {
      const intervals = allPauses
        .map((p) => {
          const pStart = DateUtils.getEndOfLocalDayInUTC(p.startDate);
          const pEnd = DateUtils.getEndOfLocalDayInUTC(p.endDate);
          return {
            start: pStart < dueDate ? dueDate.getTime() : pStart.getTime(),
            end: pEnd > evaluationDate ? evaluationDate.getTime() : pEnd.getTime(),
          };
        })
        .filter((i) => i.start <= i.end);

      if (intervals.length > 0) {
        intervals.sort((a, b) => a.start - b.start);
        const merged = [intervals[0]];
        for (let i = 1; i < intervals.length; i++) {
          const current = intervals[i];
          const last = merged[merged.length - 1];
          if (current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
          } else {
            merged.push(current);
          }
        }

        for (const m of merged) {
          pausedDays += Math.round((m.end - m.start) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    }

    const elapsedDays = Math.max(0, this.calculateElapsedDays(dueDate, evaluationDate) - pausedDays);
    const graceDays = Number(teamSeason.billingConfig?.graceDays || 0);

    if (elapsedDays <= graceDays) {
      return {
        baseChargeId: baseCharge.id,
        elapsedDays,
        penaltyDays: 0,
        lateFeePerDay: Number(teamSeason.billingConfig?.lateFeePerDay || 0),
        totalLateFeeAmount: 0,
      };
    }

    const penaltyDays = elapsedDays - graceDays;
    const lateFeePerDay = Number(teamSeason.billingConfig?.lateFeePerDay || 0);
    const totalLateFeeAmount = penaltyDays * lateFeePerDay;

    return {
      baseChargeId: baseCharge.id,
      elapsedDays,
      penaltyDays,
      lateFeePerDay,
      totalLateFeeAmount,
    };
  }

  private calculateElapsedDays(dueDate: Date, evaluationDate: Date) {
    const diffTime = evaluationDate.getTime() - dueDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }
}




