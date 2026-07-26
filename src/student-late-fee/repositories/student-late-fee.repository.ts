import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

export type StudentChargeWithLateFeeRelations = Prisma.ChargeGetPayload<{
  include: {
    studentCharges: {
      include: {
        studentMembership: {
          include: {
            pauses: true;
            courseSeason: {
              include: {
                billingConfig: true;
                pauses: true;
              };
            };
          };
        };
      };
    };
  };
}>;

const chargeInclude = {
  studentCharges: {
    include: {
      studentMembership: {
        include: {
          pauses: true,
          courseSeason: {
            include: {
              billingConfig: true,
              pauses: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class StudentLateFeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOverdueCharges(
    evaluationDate: Date,
  ): Promise<StudentChargeWithLateFeeRelations[]> {
    return this.prisma.charge.findMany({
      where: {
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        studentCharges: {
          some: {
            type: {
              in: [
                TypeMembershipCharge.RECURRING_FEE,
                TypeMembershipCharge.SEASON_FEE,
              ],
            },
            studentMembership: {
              status: {
                in: [
                  StudentMembershipStatus.ACTIVE,
                  StudentMembershipStatus.PENDING_ACTIVE,
                  StudentMembershipStatus.SUSPENDED,
                ],
              },
              courseSeason: {
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
    return tx.charge.findFirst({
      where: {
        parentChargeId,
        studentCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });
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
