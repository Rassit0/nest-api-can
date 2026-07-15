import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge, TypeMembershipCharge , StatusCourseSeason } from 'src/generated/prisma/client';
import { ExistingChargeMinimal } from '../interfaces/student-charge.types';

@Injectable()
export class StudentChargeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchExistingCharges(
    tx: Prisma.TransactionClient | PrismaService, 
    membershipId: string,
    types: TypeMembershipCharge[]
  ): Promise<ExistingChargeMinimal[]> {
    return tx.studentCharge.findMany({
      where: { studentMembershipId: membershipId, type: { in: types } },
      select: { type: true, billingYear: true, billingMonth: true, billingCycle: true },
    });
  }

  async fetchPendingFutureStudentCharges(
    membershipId: string,
    evaluationDate: Date
  ) {
    return this.prisma.studentCharge.findMany({
      where: {
        studentMembershipId: membershipId,
        charge: { status: StatusCharge.PENDING, dueDate: { gte: evaluationDate } },
        type: { in: [ TypeMembershipCharge.RECURRING_FEE, TypeMembershipCharge.REGISTRATION, TypeMembershipCharge.SEASON_FEE ] },
      },
      include: { charge: true },
    });
  }

  async checkRegistrationChargeExists(
    tx: Prisma.TransactionClient, 
    membershipId: string, 
    billingYear: number, 
    billingMonth: number
  ): Promise<boolean> {
    const exists = await tx.studentCharge.findFirst({
      where: { 
        studentMembershipId: membershipId, 
        type: TypeMembershipCharge.REGISTRATION, 
        billingYear, 
        billingMonth
      },
      select: { chargeId: true }
    });
    return !!exists;
  }

  async checkSeasonChargeExists(
    tx: Prisma.TransactionClient, 
    membershipId: string, 
    billingYear: number, 
    billingMonth: number
  ): Promise<boolean> {
    const exists = await tx.studentCharge.findFirst({
      where: { 
        studentMembershipId: membershipId, 
        type: { in: [TypeMembershipCharge.SEASON_FEE, TypeMembershipCharge.RECURRING_FEE] }, 
        billingYear, 
        billingMonth 
      },
      select: { chargeId: true }
    });
    return !!exists;
  }

  async bulkCreateCharges(
    tx: Prisma.TransactionClient,
    chargesData: Prisma.ChargeCreateManyInput[]
  ) {
    await tx.charge.createMany({ data: chargesData });
  }

  async bulkCreateStudentCharges(
    tx: Prisma.TransactionClient,
    studentChargesData: Prisma.StudentChargeCreateManyInput[]
  ) {
    await tx.studentCharge.createMany({ data: studentChargesData });
  }

  async deletePendingCharges(
    tx: Prisma.TransactionClient,
    chargeIds: string[]
  ) {
    await tx.studentCharge.deleteMany({ where: { chargeId: { in: chargeIds } } });
    await tx.charge.deleteMany({ where: { id: { in: chargeIds } } });
  }
}

