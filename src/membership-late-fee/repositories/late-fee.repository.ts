import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, Prisma, StatusCharge, TypeMembershipCharge } from 'src/generated/prisma/client';

export type ChargeWithLateFeeRelations = Prisma.ChargeGetPayload<{
  include: {
    membershipCharges: {
      include: {
        playerMembership: {
          include: {
            teamSeason: true;
          };
        };
      };
    };
  };
}>;

const chargeInclude = {
  membershipCharges: {
    include: {
      playerMembership: {
        include: {
          teamSeason: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class LateFeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOverdueCharges(evaluationDate: Date): Promise<ChargeWithLateFeeRelations[]> {
    return this.prisma.charge.findMany({
      where: {
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.RECURRING_FEE,
            playerMembership: {
              status: {
                in: [
                  PlayerMembershipStatus.ACTIVE,
                  PlayerMembershipStatus.PENDING_ACTIVE,
                  PlayerMembershipStatus.SUSPENDED,
                ],
              },
            },
          },
        },
        parentChargeId: null,
        dueDate: {
          lt: evaluationDate,
        },
      },
      include: chargeInclude,
    });
  }

  async findExistingLateFeeCharge(tx: Prisma.TransactionClient, parentChargeId: string) {
    return tx.charge.findFirst({
      where: {
        parentChargeId,
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });
  }

  async updateLateFeeCharge(tx: Prisma.TransactionClient, chargeId: string, data: Prisma.ChargeUpdateInput) {
    await tx.charge.update({
      where: { id: chargeId },
      data,
    });
  }

  async createLateFeeCharge(tx: Prisma.TransactionClient, data: Prisma.ChargeUncheckedCreateInput) {
    await tx.charge.create({
      data,
    });
  }
}
