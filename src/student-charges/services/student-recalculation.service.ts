import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentChargeRepository } from '../repositories/student-charge.repository';
import { StudentGenerationService } from './student-generation.service';
import { StudentRecalibrationDateCalculator } from '../domain/student-recalibration-date.calculator';

@Injectable()
export class StudentChargeRecalculationService {
  private readonly logger = new Logger(StudentChargeRecalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly chargeRepo: StudentChargeRepository,
    private readonly generationService: StudentGenerationService,
    private readonly calculator: StudentRecalibrationDateCalculator,
  ) {}

  /**
   * Módulo de Autorreparación/Recalibración de Cargos.
   * Invocado cuando ocurre un cambio mutacional (ej: Se le cambia el PaymentPlan al usuario).
   *
   * Lógica crítica:
   * 1. Descubre todos los cargos recurrentes pendientes a futuro.
   * 2. (PROTECCIÓN FINANCIERA): Solo selecciona aquellos donde (PendingAmount === Amount).
   * 3. Borra las cuotas elegibles.
   * 4. Retrasa el 'nextRecurringChargeGenerationDate' simulando un viaje en el tiempo.
   * 5. Fuerza un recálculo para que nazcan nuevas cuotas con los beneficios del nuevo plan.
   */
  async recalculatePendingFutureCharges(studentMembershipId: string) {
    const evaluationDate = DateUtils.getStartOfUTCDay(new Date());

    const membership =
      await this.membershipRepo.getMembershipById(studentMembershipId);
    if (!membership) return;

    await this.prisma.$transaction(async (tx) => {
      const fullyPendingStudentCharges =
        await this.chargeRepo.fetchFullyPendingFutureStudentCharges(
          tx,
          studentMembershipId,
          evaluationDate,
        );

      if (fullyPendingStudentCharges.length === 0) return;

      const chargeIds = fullyPendingStudentCharges.map((mc) => mc.chargeId);
      const recurringCharges = fullyPendingStudentCharges.filter(
        (mc) => mc.type === TypeMembershipCharge.RECURRING_FEE,
      );

      const oldNextDate = membership.nextRecurringChargeGenerationDate || null;
      const chargeGenerationDaysBefore =
        membership.courseSeason?.billingConfig?.chargeGenerationDaysBefore ?? 0;

      const resetDate = this.calculator.calculateRecalibrationDate(
        recurringCharges,
        oldNextDate,
        chargeGenerationDaysBefore,
      );

      await this.chargeRepo.deletePendingCharges(tx, chargeIds);

      if (resetDate && resetDate.getTime() !== oldNextDate?.getTime()) {
        await this.membershipRepo.updateNextGenerationPointer(
          tx,
          studentMembershipId,
          oldNextDate,
          resetDate,
        );
      }
    });

    try {
      const fakeToday = DateUtils.getEndOfUTCDay(new Date());
      const fullMembership =
        await this.membershipRepo.getMembershipById(studentMembershipId);

      if (fullMembership) {
        await this.prisma.$transaction(async (tx) => {
          await this.generationService.ensureStudentCharges(
            tx,
            fullMembership,
            fakeToday,
          );
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `No se pudo regenerar los cargos tras recálculo para ${studentMembershipId}: ${msg}`,
      );
    }
  }
}
