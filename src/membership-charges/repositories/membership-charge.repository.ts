import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { ExistingChargeMinimal } from '../interfaces/membership-charge.types';

@Injectable()
export class MembershipChargeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchExistingCharges(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    types: TypeMembershipCharge[],
  ): Promise<ExistingChargeMinimal[]> {
    return tx.membershipCharge.findMany({
      where: { playerMembershipId: membershipId, type: { in: types } },
      select: {
        type: true,
        billingYear: true,
        billingMonth: true,
        billingCycle: true,
      },
    });
  }

  async fetchFullyPendingFutureMembershipCharges(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    evaluationDate: Date,
  ) {
    const charges = await tx.membershipCharge.findMany({
      where: {
        playerMembershipId: membershipId,
        charge: {
          status: StatusCharge.PENDING,
          dueDate: { gte: evaluationDate },
        },
        type: {
          in: [
            TypeMembershipCharge.RECURRING_FEE,
            TypeMembershipCharge.REGISTRATION,
            TypeMembershipCharge.SEASON_FEE,
          ],
        },
      },
      include: { charge: true },
    });

    // Domain Rule: A charge is fully pending if it has received no partial payments.
    return charges.filter(
      (mc) => Number(mc.charge.pendingAmount) === Number(mc.charge.amount),
    );
  }

  async checkRegistrationChargeExists(
    tx: Prisma.TransactionClient,
    membershipId: string,
    billingYear: number,
    billingMonth: number,
  ): Promise<boolean> {
    const exists = await tx.membershipCharge.findFirst({
      where: {
        playerMembershipId: membershipId,
        type: TypeMembershipCharge.REGISTRATION,
        billingYear,
        billingMonth,
      },
      select: { chargeId: true },
    });
    return !!exists;
  }

  async checkSeasonChargeExists(
    tx: Prisma.TransactionClient,
    membershipId: string,
    billingYear: number,
    billingMonth: number,
  ): Promise<boolean> {
    const exists = await tx.membershipCharge.findFirst({
      where: {
        playerMembershipId: membershipId,
        type: {
          in: [
            TypeMembershipCharge.SEASON_FEE,
            TypeMembershipCharge.RECURRING_FEE,
          ],
        },
        billingYear,
        billingMonth,
      },
      select: { chargeId: true },
    });
    return !!exists;
  }

  async bulkCreateCharges(
    tx: Prisma.TransactionClient,
    chargesData: Prisma.ChargeCreateManyInput[],
  ) {
    await tx.charge.createMany({ data: chargesData });
  }

  async bulkCreateMembershipCharges(
    tx: Prisma.TransactionClient,
    membershipChargesData: Prisma.MembershipChargeCreateManyInput[],
  ) {
    await tx.membershipCharge.createMany({ data: membershipChargesData });
  }

  async bulkCreateChargesWithRelations(
    tx: Prisma.TransactionClient,
    payloads: Prisma.ChargeCreateInput[],
  ) {
    const { randomUUID } = require('crypto');
    const chunkSize = 1000;

    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      const chargesData: Prisma.ChargeCreateManyInput[] = [];
      const membershipChargesData: Prisma.MembershipChargeCreateManyInput[] =
        [];

      for (const payload of chunk) {
        const chargeId = randomUUID();
        const chargeFields = { ...payload };
        delete chargeFields.membershipCharges;

        chargesData.push({
          id: chargeId,
          ...(chargeFields as any),
        });

        const mcCreate = payload.membershipCharges?.create;
        if (mcCreate && !Array.isArray(mcCreate)) {
          membershipChargesData.push({
            chargeId,
            ...mcCreate,
          } as Prisma.MembershipChargeCreateManyInput);
        }
      }

      await tx.charge.createMany({ data: chargesData });
      await tx.membershipCharge.createMany({ data: membershipChargesData });
    }
  }

  async deletePendingCharges(
    tx: Prisma.TransactionClient,
    chargeIds: string[],
  ) {
    // 1. Eliminamos de la tabla pivote de membresía (no tiene status propio, depende de su ID)
    await tx.membershipCharge.deleteMany({
      where: { chargeId: { in: chargeIds } },
    });

    // 2. [BLINDAJE CRÍTICO] Eliminamos los cargos reales SOLO SI siguen en estado PENDING en la BD.
    // Esto previene borrar cargos que se hayan pagado una fracción de segundo antes de ejecutarse esta transacción.
    await tx.charge.deleteMany({
      where: {
        id: { in: chargeIds },
        status: StatusCharge.PENDING, // ¡Protección contra condición de carrera!
      },
    });
  }
}
