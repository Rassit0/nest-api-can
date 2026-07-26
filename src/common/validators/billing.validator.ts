import { BadRequestException } from '@nestjs/common';
import { SeasonBillingType } from 'src/generated/prisma/client';

export class BillingValidator {
  /**
   * Asegura que el plan de facturación de la membresía NO sea de pago único (SINGLE_ONLY).
   * Los adelantos de cuotas no tienen sentido y causan inconsistencias si se aplican a planes de un solo pago.
   */
  static assertNotSinglePayment(
    billingConfig: { billingType: SeasonBillingType } | null | undefined,
    paymentPlan: { isSinglePayment: boolean } | null | undefined,
  ): void {
    const isSeasonFeeOnly =
      billingConfig?.billingType === 'SINGLE_ONLY' ||
      (billingConfig?.billingType === 'BOTH' &&
        paymentPlan?.isSinglePayment === true);

    if (isSeasonFeeOnly) {
      throw new BadRequestException(
        'No se pueden adelantar cuotas para una membresía configurada como pago único de temporada.',
      );
    }
  }
}
