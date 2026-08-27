import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

export class MembershipChargeFactory {
  static createChargePayload(
    membershipId: string,
    type: TypeMembershipCharge,
    baseAmount: number,
    adjustmentAmount: number,
    description: string,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null,
    adjustmentReason?: string | null,
  ): Prisma.ChargeCreateInput {
    // Protección contra Race Conditions en Postgres (null != null)
    let safeBillingCycle = billingCycle;
    if (safeBillingCycle == null) {
      if (
        type !== TypeMembershipCharge.MANUAL &&
        type !== TypeMembershipCharge.LATE_FEE
      ) {
        safeBillingCycle = 0; // Usar 0 para activar la protección de @@unique
      } else {
        safeBillingCycle = null; // Manual y Multas sí permiten múltiples en un mes
      }
    }

    return {
      description,
      amount: baseAmount,
      adjustmentAmount: adjustmentAmount,
      adjustmentReason: adjustmentReason || null,
      pendingAmount: Math.max(0, baseAmount + adjustmentAmount),
      dueDate,
      status: StatusCharge.PENDING,
      membershipCharges: {
        create: {
          playerMembershipId: membershipId,
          type,
          billingYear,
          billingMonth,
          billingCycle: safeBillingCycle,
        },
      },
    };
  }

  static buildRegistrationChargePayload(
    membershipId: string,
    baseAmount: number,
    adjustmentAmount: number,
    description: string,
    dueDate: Date,
    adjustmentReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.REGISTRATION,
      baseAmount,
      adjustmentAmount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1,
      null,
      adjustmentReason,
    );
  }

  static buildSeasonChargePayload(
    membershipId: string,
    baseAmount: number,
    adjustmentAmount: number,
    description: string,
    dueDate: Date,
    startBillingYear: number,
    startBillingMonth: number,
    adjustmentReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.SEASON_FEE,
      baseAmount,
      adjustmentAmount,
      description,
      dueDate,
      startBillingYear,
      startBillingMonth,
      null,
      adjustmentReason,
    );
  }

  static buildManualChargePayload(
    membershipId: string,
    baseAmount: number,
    adjustmentAmount: number,
    description: string,
    dueDate: Date,
    adjustmentReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.MANUAL,
      baseAmount,
      adjustmentAmount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1,
      null,
      adjustmentReason,
    );
  }

  static buildRecurringChargePayload(
    membershipId: string,
    baseAmount: number,
    adjustmentAmount: number,
    description: string,
    groupDueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null,
    adjustmentReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.RECURRING_FEE,
      baseAmount,
      adjustmentAmount,
      description,
      groupDueDate,
      billingYear,
      billingMonth,
      billingCycle,
      adjustmentReason,
    );
  }
}
