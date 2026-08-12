import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import {
  StudentLateFeeRepository,
  StudentChargeWithLateFeeRelations,
} from './repositories/student-late-fee.repository';

@Injectable()
export class StudentLateFeeService {
  private readonly logger = new Logger(StudentLateFeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lateFeeRepo: StudentLateFeeRepository,
  ) {}

  /**
   * Proceso principal para aplicar recargos a todos los cargos vencidos en el sistema.
   * Este método puede ser llamado por un Cron Job todas las noches.
   */
  async applyDailyLateFees() {
    this.logger.log(
      'Iniciando proceso diario de cálculo de recargos escolares (mora)...',
    );

    const evaluationDate = DateUtils.getStartOfUTCDay(new Date());

    const overdueCharges =
      await this.lateFeeRepo.findOverdueCharges(evaluationDate);

    this.logger.log(
      `Se encontraron ${overdueCharges.length} cargos escolares vencidos base.`,
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
            `Error procesando recargos de mora para el cargo escolar ID ${baseCharge.id}:`,
            error,
          );
        }
      }
    }

    this.logger.log('Proceso de recargos escolares finalizado.');
  }

  /**
   * Lógica interna para evaluar y aplicar la mora a un cargo individual
   */
  private async processChargeLateFee(
    tx: Prisma.TransactionClient,
    baseCharge: StudentChargeWithLateFeeRelations,
    evaluationDate: Date,
  ) {
    const studentChargeRelation = baseCharge.studentCharges[0];
    if (!studentChargeRelation) return;

    const courseSeason = studentChargeRelation.studentMembership?.courseSeason;
    if (
      !courseSeason ||
      !courseSeason.billingConfig?.lateFeeEnabled ||
      courseSeason.billingConfig?.isEngineActive === false
    )
      return;

    const dueDate = DateUtils.getStartOfUTCDay(baseCharge.dueDate);

    const courseSeasonPauses = courseSeason.pauses || [];
    const individualPauses =
      studentChargeRelation.studentMembership?.pauses || [];

    const allPauses = [...courseSeasonPauses, ...individualPauses];
    let pausedDays = 0;

    if (allPauses.length > 0) {
      const intervals = allPauses
        .map((p) => {
          const pStart = DateUtils.getStartOfUTCDay(p.startDate);
          const pEnd = DateUtils.getStartOfUTCDay(p.endDate);
          return {
            start: pStart < dueDate ? dueDate.getTime() : pStart.getTime(),
            end:
              pEnd > evaluationDate ? evaluationDate.getTime() : pEnd.getTime(),
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
          pausedDays +=
            Math.round((m.end - m.start) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    }

    const elapsedDays =
      this.calculateElapsedDays(dueDate, evaluationDate) - pausedDays;

    const graceDays = Number(courseSeason.billingConfig?.graceDays || 0);

    if (elapsedDays <= graceDays) return;

    const penaltyDays = elapsedDays - graceDays;
    const lateFeePerDay = Number(
      courseSeason.billingConfig?.lateFeePerDay || 0,
    );
    const targetLateFeeAmount = penaltyDays * lateFeePerDay;

    if (targetLateFeeAmount <= 0) return;

    const existingLateFeeCharge =
      await this.lateFeeRepo.findExistingLateFeeCharge(tx, baseCharge.id);

    if (existingLateFeeCharge) {
      if (
        existingLateFeeCharge.status === StatusCharge.PENDING ||
        existingLateFeeCharge.status === StatusCharge.PARTIAL ||
        existingLateFeeCharge.status === StatusCharge.PAID
      ) {
        const previousAmount = Number(existingLateFeeCharge.amount);
        const difference = targetLateFeeAmount - previousAmount;

        if (difference > 0) {
          await this.lateFeeRepo.updateLateFeeCharge(
            tx,
            existingLateFeeCharge.id,
            {
              amount: targetLateFeeAmount,
              pendingAmount:
                Number(existingLateFeeCharge.pendingAmount) + difference,
              status:
                existingLateFeeCharge.status === StatusCharge.PAID
                  ? StatusCharge.PARTIAL
                  : existingLateFeeCharge.status,
              description: `Recargo Mora Curso - ${penaltyDays} x ${lateFeePerDay}/día`,
            },
          );
        }
      }
    } else {
      await this.lateFeeRepo.createLateFeeCharge(tx, {
        parentChargeId: baseCharge.id,
        chargeCategory: 'LATE_FEE',
        description: `Recargo Mora Curso - ${penaltyDays} días de retraso`,
        amount: targetLateFeeAmount,
        pendingAmount: targetLateFeeAmount,
        dueDate: evaluationDate,
        status: StatusCharge.PENDING,
        studentCharges: {
          create: {
            type: TypeMembershipCharge.LATE_FEE,
            studentMembershipId: studentChargeRelation.studentMembershipId,
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
