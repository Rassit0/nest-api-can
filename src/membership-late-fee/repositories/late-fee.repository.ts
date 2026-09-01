import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  PlayerMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { lockChargeForUpdate } from 'src/common/utils/charge-lock.util';

export type ChargeWithLateFeeRelations = Prisma.ChargeGetPayload<{
  include: {
    membershipCharges: {
      include: {
        playerMembership: {
          include: {
            pauses: true;
            teamSeason: {
              include: {
                billingConfig: true;
                teamSeasonPauses: true;
              };
            };
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
          pauses: true,
          teamSeason: {
            include: {
              billingConfig: true,
              teamSeasonPauses: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class LateFeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChargeForLateFee(
    chargeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ChargeWithLateFeeRelations | null> {
    const client = tx || this.prisma;
    return client.charge.findUnique({
      where: { id: chargeId },
      include: chargeInclude,
    });
  }

  async findPendingLateFeeCharge(
    tx: Prisma.TransactionClient,
    parentChargeId: string,
  ) {
    return tx.charge.findFirst({
      where: {
        parentChargeId,
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });
  }

  async findOverdueCharges(
    evaluationDate: Date,
  ): Promise<ChargeWithLateFeeRelations[]> {
    return this.prisma.charge.findMany({
      where: {
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        membershipCharges: {
          some: {
            type: {
              in: [
                TypeMembershipCharge.RECURRING_FEE,
                TypeMembershipCharge.SEASON_FEE,
              ],
            },
            playerMembership: {
              status: {
                in: [
                  PlayerMembershipStatus.ACTIVE,

                  PlayerMembershipStatus.SUSPENDED,
                ],
              },
              teamSeason: {
                billingConfig: {
                  isEngineActive: true,
                },
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

  async findExistingLateFeeCharge(
    tx: Prisma.TransactionClient,
    parentChargeId: string,
  ) {
    const charge = await tx.charge.findFirst({
      where: {
        parentChargeId,
        membershipCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });

    if (!charge) return null;

    // INFO: El Charge debe bloquearse antes de leer/calcular amount/pendingAmount.
    // Late Fees modifican amount, pendingAmount y status. Sin lock, concurrencia 
    // con pagos causaría Lost Updates.
    const lockedCharge = await lockChargeForUpdate(tx, charge.id);
    
    charge.amount = new Prisma.Decimal(lockedCharge.amount.toString());
    charge.pendingAmount = new Prisma.Decimal(lockedCharge.pendingAmount.toString());
    charge.status = lockedCharge.status;
    charge.adjustmentAmount = lockedCharge.adjustmentAmount ? new Prisma.Decimal(lockedCharge.adjustmentAmount.toString()) : null;

    return charge;
  }

  async updateLateFeeCharge(
    tx: Prisma.TransactionClient,
    chargeId: string,
    data: Prisma.ChargeUpdateInput,
  ) {
    await tx.charge.update({
      where: { id: chargeId },
      data,
    });
  }

  async createLateFeeCharge(
    tx: Prisma.TransactionClient,
    data: Prisma.ChargeUncheckedCreateInput,
  ) {
    await tx.charge.create({
      data,
    });
  }
}
