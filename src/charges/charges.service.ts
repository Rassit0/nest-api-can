import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { syncCycleEnrollmentStatus } from 'src/common/helpers/sync-cycle-enrollment.helper';

export const chargeSelect: Prisma.ChargeSelect = {
  id: true,
  description: true,
  amount: true,
  pendingAmount: true,
  adjustmentAmount: true,
  adjustmentReason: true,
  dueDate: true,
  status: true,
  parentChargeId: true,
  createdAt: true,
  updatedAt: true,
  parentCharge: {
    select: {
      id: true,
      description: true,
      amount: true,
    },
  },
  childCharges: {
    select: {
      id: true,
      description: true,
      amount: true,
      pendingAmount: true,
      status: true,
    },
  },
  membershipCharges: {
    select: {
      id: true,
      type: true,
      playerMembership: {
        select: {
          id: true,
          player: {
            select: {
              id: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  email: true,
                  documentNumber: true,
                  gender: true,
                  birthDate: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  },
  studentCharges: {
    select: {
      id: true,
      type: true,
      studentMembership: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  email: true,
                  documentNumber: true,
                  gender: true,
                  birthDate: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  },
  payments: {
    select: {
      amount: true,
      status: true,
    },
  },
};

function mapChargeForFrontend(charge: any) {
  const amount = Number(charge.amount);
  const adjustmentAmount = Number(charge.adjustmentAmount || 0);

  const paidAmount = charge.payments
    ? charge.payments
        .filter((p: any) => p.status === 'COMPLETED')
        .reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    : 0;

  const expectedTotal = amount + adjustmentAmount;
  const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= expectedTotal;
  const hasAdjustment = adjustmentAmount !== 0;

  const canEditAdjustment = charge.status !== 'CANCELLED' && !isFullyPaidWithMoney;
  const canRemoveAdjustment = hasAdjustment && charge.status !== 'CANCELLED' && !isFullyPaidWithMoney;

  const { payments, ...chargeWithoutPayments } = charge;

  return {
    ...chargeWithoutPayments,
    canEditAdjustment,
    canRemoveAdjustment,
  };
}

@Injectable()
export class ChargesService {
  private readonly logger = new Logger('ChargesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createChargeDto: CreateChargeDto, tx?: Prisma.TransactionClient) {
    const { amount, pendingAmount } = createChargeDto;

    // Si pendingAmount no es proveído, por defecto es igual a amount
    const chargeData = {
      ...createChargeDto,
      pendingAmount:
        pendingAmount !== undefined && pendingAmount !== null
          ? pendingAmount
          : amount,
    };

    const prismaClient = tx || this.prisma;
    const newCharge = await prismaClient.charge.create({
      data: chargeData,
      select: chargeSelect,
    });

    return {
      message: 'Cargo facturado creado exitosamente',
      data: mapChargeForFrontend(newCharge),
    };
  }

  async findAll(paginationDto: ChargesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      playerMembershipId,
      studentMembershipId,
      teamSeasonId,
      courseSeasonId,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.ChargeWhereInput = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        {
          membershipCharges: {
            some: {
              playerMembership: {
                player: {
                  person: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          studentCharges: {
            some: {
              studentMembership: {
                student: {
                  person: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        },
      ];
    }

    if (playerMembershipId) {
      where.membershipCharges = {
        some: {
          playerMembership: {
            id: playerMembershipId,
          },
        },
      };
    }

    if (studentMembershipId) {
      where.studentCharges = {
        some: {
          studentMembership: {
            id: studentMembershipId,
          },
        },
      };
    }

    if (teamSeasonId) {
      where.membershipCharges = {
        some: {
          playerMembership: {
            teamSeasonId,
          },
        },
      };
    }

    if (courseSeasonId) {
      where.studentCharges = {
        some: {
          studentMembership: {
            courseSeasonId,
          },
        },
      };
    }

    const [charges, totalItems] = await Promise.all([
      this.prisma.charge.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: chargeSelect,
      }),
      this.prisma.charge.count({ where }),
    ]);

    const mappedCharges = charges.map(mapChargeForFrontend);

    return createPaginationResult(
      mappedCharges,
      totalItems,
      page,
      per_page,
      'Cargos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      select: chargeSelect,
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }
    return {
      message: 'Cargo obtenido exitosamente',
      data: mapChargeForFrontend(charge),
    };
  }

  async update(id: string, updateChargeDto: UpdateChargeDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        membershipCharges: true,
        studentCharges: true,
        payments: true,
      },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const isManual =
      charge.membershipCharges.some((mc) => mc.type === 'MANUAL') ||
      charge.studentCharges.some((sc) => sc.type === 'MANUAL');

    if (!isManual) {
      throw new BadRequestException(
        'Solo se pueden editar cargos creados de forma manual.',
      );
    }

    if (charge.payments && charge.payments.length > 0) {
      throw new BadRequestException(
        'No se puede editar un cargo que ya tiene transacciones (pagos) registradas.',
      );
    }

    const { parentChargeId, ...rest } = updateChargeDto;
    const data: Prisma.ChargeUpdateInput = { ...rest };

    if (rest.amount !== undefined) {
      const newAmount = Number(rest.amount);
      const adjustment = Number(charge.adjustmentAmount || 0);
      const newExpectedTotal = newAmount + adjustment;

      if (newExpectedTotal < 0) {
        throw new BadRequestException(
          'El nuevo monto base sumado al ajuste no puede ser negativo.',
        );
      }

      const oldExpectedTotal = Number(charge.amount) + Number(charge.adjustmentAmount || 0);
      const paidAmount = oldExpectedTotal - Number(charge.pendingAmount);

      let newPending = newExpectedTotal - paidAmount;
      if (newPending < 0) newPending = 0;

      data.pendingAmount = newPending;
      if (newPending === 0) data.status = StatusCharge.PAID;
      else if (paidAmount > 0) data.status = StatusCharge.PARTIAL;
      else data.status = StatusCharge.PENDING;
    }

    if (parentChargeId !== undefined) {
      if (parentChargeId === null) {
        data.parentCharge = { disconnect: true };
      } else {
        data.parentCharge = { connect: { id: parentChargeId } };
      }
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.charge.update({
        where: { id },
        data,
        select: chargeSelect,
      });

      if (data.status) {
        await syncCycleEnrollmentStatus(tx, id, data.status as StatusCharge);
      }

      return updated;
    });

    return {
      message: 'Cargo actualizado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }

  async remove(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        membershipCharges: true,
        studentCharges: true,
        payments: true,
      },
    });

    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const isManual =
      charge.membershipCharges.some((mc) => mc.type === 'MANUAL') ||
      charge.studentCharges.some((sc) => sc.type === 'MANUAL');

    if (!isManual) {
      throw new BadRequestException(
        'Solo se pueden eliminar cargos creados de forma manual.',
      );
    }

    if (charge.payments && charge.payments.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el cargo porque tiene transacciones (pagos) asociadas.',
      );
    }

    const deletedCharge = await this.prisma.$transaction(async (tx) => {
      if (charge.membershipCharges.length > 0) {
        await tx.membershipCharge.deleteMany({
          where: { chargeId: id },
        });
      }

      if (charge.studentCharges.length > 0) {
        await tx.studentCharge.deleteMany({
          where: { chargeId: id },
        });
      }

      return tx.charge.delete({
        where: { id },
        select: chargeSelect,
      });
    });

    return {
      message: 'Cargo eliminado exitosamente',
      data: mapChargeForFrontend(deletedCharge),
    };
  }

  async addAdjustment(id: string, addAdjustmentDto: AddAdjustmentDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const amount = Number(charge.amount);
    const newAdjustment = Number(addAdjustmentDto.adjustmentAmount);
    
    const newExpectedTotal = amount + newAdjustment;

    if (newExpectedTotal < 0) {
      throw new BadRequestException(
        'El total esperado (monto + ajuste) no puede ser negativo',
      );
    }

    const oldAdjustment = Number(charge.adjustmentAmount || 0);

    const paidAmount = charge.payments
      ? charge.payments
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + Number(p.amount), 0)
      : 0;

    const oldExpectedTotal = amount + oldAdjustment;
    const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= oldExpectedTotal;

    if (charge.status === 'CANCELLED') {
      throw new BadRequestException('No se puede modificar un cargo cancelado.');
    }

    if (isFullyPaidWithMoney) {
      throw new BadRequestException(
        'No se puede modificar el ajuste de un cargo que ya fue pagado completamente con dinero real.',
      );
    }

    let newPending = newExpectedTotal - paidAmount;
    if (newPending < 0) {
      newPending = 0;
    }

    let newStatus: StatusCharge;
    if (newPending <= 0) {
      newStatus = StatusCharge.PAID;
    } else if (paidAmount > 0) {
      newStatus = StatusCharge.PARTIAL;
    } else {
      newStatus = StatusCharge.PENDING;
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.charge.update({
        where: { id },
        data: {
          adjustmentAmount: newAdjustment,
          adjustmentReason: addAdjustmentDto.adjustmentReason,
          pendingAmount: newPending,
          status: newStatus,
        },
        select: chargeSelect,
      });
      await syncCycleEnrollmentStatus(tx, id, newStatus);
      return updated;
    });

    return {
      message: 'Ajuste agregado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }

  async removeAdjustment(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const oldAdjustment = Number(charge.adjustmentAmount || 0);
    if (oldAdjustment === 0) {
      throw new BadRequestException('El cargo no tiene un ajuste aplicado');
    }

    const amount = Number(charge.amount);
    const paidAmount = charge.payments
      ? charge.payments
          .filter((p) => p.status === 'COMPLETED')
          .reduce((sum, p) => sum + Number(p.amount), 0)
      : 0;

    const oldExpectedTotal = amount + oldAdjustment;
    const isFullyPaidWithMoney = paidAmount > 0 && paidAmount >= oldExpectedTotal;

    if (charge.status === 'CANCELLED') {
      throw new BadRequestException('No se puede modificar un cargo cancelado.');
    }

    if (isFullyPaidWithMoney) {
      throw new BadRequestException(
        'No se puede remover el ajuste de un cargo que ya fue pagado completamente con dinero real.',
      );
    }

    const newExpectedTotal = amount; // Sin ajuste

    let newPending = newExpectedTotal - paidAmount;
    if (newPending < 0) {
      newPending = 0;
    }

    let newStatus: StatusCharge;
    if (newPending <= 0) {
      newStatus = StatusCharge.PAID;
    } else if (paidAmount > 0) {
      newStatus = StatusCharge.PARTIAL;
    } else {
      newStatus = StatusCharge.PENDING;
    }

    const updatedCharge = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.charge.update({
        where: { id },
        data: {
          adjustmentAmount: 0,
          adjustmentReason: null,
          pendingAmount: newPending,
          status: newStatus,
        },
        select: chargeSelect,
      });
      await syncCycleEnrollmentStatus(tx, id, newStatus);
      return updated;
    });

    return {
      message: 'Ajuste eliminado exitosamente',
      data: mapChargeForFrontend(updatedCharge),
    };
  }
}
