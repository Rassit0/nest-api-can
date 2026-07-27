import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
  StatusCourseSeason,
} from 'src/generated/prisma/client';

export class StudentChargeFactory {
  static createChargePayload(
    membershipId: string,
    type: TypeMembershipCharge,
    baseAmount: number,
    discountAmount: number,
    description: string,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null,
    discountReason?: string | null,
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
      discountAmount: discountAmount,
      discountReason: discountReason || null,
      pendingAmount: Math.max(0, baseAmount - discountAmount),
      dueDate,
      status: StatusCharge.PENDING,
      studentCharges: {
        create: {
          studentMembershipId: membershipId,
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
    discountAmount: number,
    description: string,
    dueDate: Date,
    discountReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.REGISTRATION,
      baseAmount,
      discountAmount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1,
      null,
      discountReason,
    );
  }

  static buildSeasonChargePayload(
    membershipId: string,
    baseAmount: number,
    discountAmount: number,
    description: string,
    dueDate: Date,
    startBillingYear: number,
    startBillingMonth: number,
    discountReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.SEASON_FEE,
      baseAmount,
      discountAmount,
      description,
      dueDate,
      startBillingYear,
      startBillingMonth,
      null,
      discountReason,
    );
  }

  static buildManualChargePayload(
    membershipId: string,
    baseAmount: number,
    discountAmount: number,
    description: string,
    dueDate: Date,
    discountReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.MANUAL,
      baseAmount,
      discountAmount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1,
      null,
      discountReason,
    );
  }

  static buildRecurringChargePayload(
    membershipId: string,
    baseAmount: number,
    discountAmount: number,
    description: string,
    groupDueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle: number | null,
    discountReason?: string | null,
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.RECURRING_FEE,
      baseAmount,
      discountAmount,
      description,
      groupDueDate,
      billingYear,
      billingMonth,
      billingCycle,
      discountReason,
    );
  }
}
