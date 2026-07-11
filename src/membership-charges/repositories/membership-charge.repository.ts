import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';
import { ExistingChargeMinimal } from '../interfaces/membership-charge.types';

@Injectable()
export class MembershipChargeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async fetchExistingCharges(
    tx: Prisma.TransactionClient | PrismaService, 
    membershipId: string,
    types: TypeMembershipCharge[]
  ): Promise<ExistingChargeMinimal[]> {
    return tx.membershipCharge.findMany({
      where: { playerMembershipId: membershipId, type: { in: types } },
      select: { type: true, billingYear: true, billingMonth: true, billingCycle: true },
    });
  }

  async fetchPendingFutureMembershipCharges(
    membershipId: string,
    evaluationDate: Date
  ) {
    return this.prisma.membershipCharge.findMany({
      where: {
        playerMembershipId: membershipId,
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
    const exists = await tx.membershipCharge.findFirst({
      where: { 
        playerMembershipId: membershipId, 
        type: TypeMembershipCharge.REGISTRATION, 
        billingYear, 
        billingMonth, 
        billingCycle: null 
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
    const exists = await tx.membershipCharge.findFirst({
      where: { 
        playerMembershipId: membershipId, 
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

  async bulkCreateMembershipCharges(
    tx: Prisma.TransactionClient,
    membershipChargesData: Prisma.MembershipChargeCreateManyInput[]
  ) {
    await tx.membershipCharge.createMany({ data: membershipChargesData });
  }

  async deletePendingCharges(
    tx: Prisma.TransactionClient,
    chargeIds: string[]
  ) {
    await tx.membershipCharge.deleteMany({ where: { chargeId: { in: chargeIds } } });
    await tx.charge.deleteMany({ where: { id: { in: chargeIds } } });
  }
}
