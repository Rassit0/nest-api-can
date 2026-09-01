import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { lockChargeForUpdate } from 'src/common/utils/charge-lock.util';

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

  async findChargeForLateFee(
    chargeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StudentChargeWithLateFeeRelations | null> {
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
        studentCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });
  }

  async findExistingLateFeeCharge(
    tx: Prisma.TransactionClient,
    parentChargeId: string,
  ) {
    const charge = await tx.charge.findFirst({
      where: {
        parentChargeId,
        studentCharges: {
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
    return tx.charge.create({
      data,
    });
  }
}
