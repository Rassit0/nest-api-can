import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TypeMembershipCharge } from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import { MembershipRepository } from '../repositories/membership.repository';
import { MembershipChargeRepository } from '../repositories/membership-charge.repository';
import { MembershipGenerationService } from './membership-generation.service';
import { MembershipRecalibrationDateCalculator } from '../domain/membership-recalibration-date.calculator';

@Injectable()
export class MembershipChargeRecalculationService {
  private readonly logger = new Logger(
    MembershipChargeRecalculationService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: MembershipRepository,
    private readonly chargeRepo: MembershipChargeRepository,
    private readonly generationService: MembershipGenerationService,
    private readonly calculator: MembershipRecalibrationDateCalculator,
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
  async recalculatePendingFutureCharges(playerMembershipId: string) {
    const evaluationDate = DateUtils.getStartOfUTCDay(new Date());

    const membership =
      await this.membershipRepo.getMembershipById(playerMembershipId);
    if (!membership) return;

    await this.prisma.$transaction(async (tx) => {
      const fullyPendingMembershipCharges =
        await this.chargeRepo.fetchFullyPendingFutureMembershipCharges(
          tx,
          playerMembershipId,
          evaluationDate,
        );

      if (fullyPendingMembershipCharges.length === 0) return;

      const chargeIds = fullyPendingMembershipCharges.map((mc) => mc.chargeId);
      const recurringCharges = fullyPendingMembershipCharges.filter(
        (mc) => mc.type === TypeMembershipCharge.RECURRING_FEE,
      );

      const oldNextDate = membership.nextRecurringChargeGenerationDate || null;
      const chargeGenerationDaysBefore =
        membership.teamSeason?.billingConfig?.chargeGenerationDaysBefore ?? 0;

      const resetDate = this.calculator.calculateRecalibrationDate(
        recurringCharges,
        oldNextDate,
        chargeGenerationDaysBefore,
      );

      await this.chargeRepo.deletePendingCharges(tx, chargeIds);

      if (resetDate && resetDate.getTime() !== oldNextDate?.getTime()) {
        await this.membershipRepo.updateNextGenerationPointer(
          tx,
          playerMembershipId,
          oldNextDate,
          resetDate,
        );
      }
    });

    try {
      const fakeToday = DateUtils.getEndOfUTCDay(new Date());
      const fullMembership =
        await this.membershipRepo.getMembershipById(playerMembershipId);

      if (fullMembership) {
        await this.prisma.$transaction(async (tx) => {
          await this.generationService.ensureMembershipCharges(
            tx,
            fullMembership,
            fakeToday,
          );
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `No se pudo regenerar los cargos tras recálculo para ${playerMembershipId}: ${msg}`,
      );
    }
  }
}
