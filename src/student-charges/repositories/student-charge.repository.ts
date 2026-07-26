import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
  StatusCourseSeason,
} from 'src/generated/prisma/client';
import { ExistingChargeMinimal } from '../interfaces/student-charge.types';

@Injectable()
export class StudentChargeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchExistingCharges(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    types: TypeMembershipCharge[],
  ): Promise<ExistingChargeMinimal[]> {
    return tx.studentCharge.findMany({
      where: { studentMembershipId: membershipId, type: { in: types } },
      select: {
        type: true,
        billingYear: true,
        billingMonth: true,
        billingCycle: true,
      },
    });
  }

  async fetchFullyPendingFutureStudentCharges(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    evaluationDate: Date,
  ) {
    const charges = await tx.studentCharge.findMany({
      where: {
        studentMembershipId: membershipId,
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
    const exists = await tx.studentCharge.findFirst({
      where: {
        studentMembershipId: membershipId,
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
    const exists = await tx.studentCharge.findFirst({
      where: {
        studentMembershipId: membershipId,
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

  async bulkCreateStudentCharges(
    tx: Prisma.TransactionClient,
    studentChargesData: Prisma.StudentChargeCreateManyInput[],
  ) {
    await tx.studentCharge.createMany({ data: studentChargesData });
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
      const studentChargesData: Prisma.StudentChargeCreateManyInput[] = [];

      for (const payload of chunk) {
        const chargeId = randomUUID();
        const chargeFields = { ...payload };
        delete chargeFields.studentCharges;

        chargesData.push({
          id: chargeId,
          ...(chargeFields as any),
        });

        const mcCreate = payload.studentCharges?.create;
        if (mcCreate && !Array.isArray(mcCreate)) {
          studentChargesData.push({
            chargeId,
            ...mcCreate,
          } as Prisma.StudentChargeCreateManyInput);
        }
      }

      await tx.charge.createMany({ data: chargesData });
      await tx.studentCharge.createMany({ data: studentChargesData });
    }
  }

  async deletePendingCharges(
    tx: Prisma.TransactionClient,
    chargeIds: string[],
  ) {
    // 1. Eliminamos de la tabla pivote de membresía
    await tx.studentCharge.deleteMany({
      where: { chargeId: { in: chargeIds } },
    });

    // 2. [BLINDAJE CRÍTICO] Eliminamos los cargos reales SOLO SI siguen en estado PENDING en la BD.
    await tx.charge.deleteMany({
      where: {
        id: { in: chargeIds },
        status: StatusCharge.PENDING, // ¡Protección contra condición de carrera!
      },
    });
  }
}
