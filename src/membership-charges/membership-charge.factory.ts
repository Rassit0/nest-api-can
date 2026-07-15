import { Prisma, StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';

export class MembershipChargeFactory {
  static createChargePayload(
    membershipId: string,
    type: TypeMembershipCharge,
    amount: number,
    description: string,
    dueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null
  ): Prisma.ChargeCreateInput {
    // Protección contra Race Conditions en Postgres (null != null)
    let safeBillingCycle = billingCycle;
    if (safeBillingCycle == null) {
      if (type !== TypeMembershipCharge.MANUAL && type !== TypeMembershipCharge.LATE_FEE) {
        safeBillingCycle = 0; // Usar 0 para activar la protección de @@unique
      } else {
        safeBillingCycle = null; // Manual y Multas sí permiten múltiples en un mes
      }
    }

    return {
      description,
      amount,
      pendingAmount: amount,
      dueDate,
      status: amount > 0 ? StatusCharge.PENDING : StatusCharge.PAID,
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
    amount: number,
    description: string,
    dueDate: Date
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.REGISTRATION,
      amount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1
    );
  }

  static buildSeasonChargePayload(
    membershipId: string,
    amount: number,
    description: string,
    dueDate: Date,
    startBillingYear: number,
    startBillingMonth: number
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.SEASON_FEE,
      amount,
      description,
      dueDate,
      startBillingYear,
      startBillingMonth
    );
  }

  static buildManualChargePayload(
    membershipId: string,
    amount: number,
    description: string,
    dueDate: Date
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.MANUAL,
      amount,
      description,
      dueDate,
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth() + 1
    );
  }

  static buildRecurringChargePayload(
    membershipId: string,
    amount: number,
    description: string,
    groupDueDate: Date,
    billingYear: number,
    billingMonth: number,
    billingCycle?: number | null
  ): Prisma.ChargeCreateInput {
    return this.createChargePayload(
      membershipId,
      TypeMembershipCharge.RECURRING_FEE,
      amount,
      description,
      groupDueDate,
      billingYear,
      billingMonth,
      billingCycle
    );
  }
}
