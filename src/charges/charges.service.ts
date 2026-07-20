import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { AddDiscountDto } from './dto/add-discount.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const chargeSelect: Prisma.ChargeSelect = {
  id: true,
  description: true,
  amount: true,
  pendingAmount: true,
  discountAmount: true,
  discountReason: true,
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
                  email: true,
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
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class ChargesService {
  private readonly logger = new Logger('ChargesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createChargeDto: CreateChargeDto) {
    const { amount, pendingAmount } = createChargeDto;

    // Si pendingAmount no es proveído, por defecto es igual a amount
    const chargeData = {
      ...createChargeDto,
      pendingAmount:
        pendingAmount !== undefined && pendingAmount !== null
          ? pendingAmount
          : amount,
    };

    const newCharge = await this.prisma.charge.create({
      data: chargeData,
      select: chargeSelect,
    });

    return {
      message: 'Cargo facturado creado exitosamente',
      data: newCharge,
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

    return createPaginationResult(
      charges,
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
      data: charge,
    };
  }

  async update(id: string, updateChargeDto: UpdateChargeDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        membershipCharges: true,
        studentCharges: true,
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

    if (charge.status !== StatusCharge.PENDING) {
      throw new BadRequestException(
        'No se puede editar un cargo que ya tiene pagos parciales o está pagado.',
      );
    }

    const { parentChargeId, ...rest } = updateChargeDto;
    const data: Prisma.ChargeUpdateInput = { ...rest };

    if (rest.amount !== undefined) {
      const newAmount = Number(rest.amount);
      const discount = Number(charge.discountAmount || 0);

      if (discount > newAmount) {
        throw new BadRequestException(
          'El nuevo monto base no puede ser menor al descuento ya aplicado.',
        );
      }

      let newPending = newAmount - discount;
      if (newPending < 0) newPending = 0;

      data.pendingAmount = newPending;
      if (newPending === 0) data.status = StatusCharge.PAID;
      else data.status = StatusCharge.PENDING;
    }

    if (parentChargeId !== undefined) {
      if (parentChargeId === null) {
        data.parentCharge = { disconnect: true };
      } else {
        data.parentCharge = { connect: { id: parentChargeId } };
      }
    }

    const updatedCharge = await this.prisma.charge.update({
      where: { id },
      data,
      select: chargeSelect,
    });

    return {
      message: 'Cargo actualizado exitosamente',
      data: updatedCharge,
    };
  }

  async remove(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        membershipCharges: true,
        studentCharges: true,
        chargeTransactions: true,
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

    if (charge.status !== StatusCharge.PENDING) {
      throw new BadRequestException(
        'No se puede eliminar un cargo que ya tiene pagos parciales o está pagado.',
      );
    }
    
    if (charge.chargeTransactions && charge.chargeTransactions.length > 0) {
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
      data: deletedCharge,
    };
  }

  async addDiscount(id: string, addDiscountDto: AddDiscountDto) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const amount = Number(charge.amount);
    const newDiscount = Number(addDiscountDto.discountAmount);

    if (newDiscount > amount) {
      throw new BadRequestException(
        'El descuento no puede ser mayor al monto original del cargo',
      );
    }

    const oldDiscount = Number(charge.discountAmount || 0);
    const currentPending = Number(charge.pendingAmount || 0);

    const paidAmount = amount - oldDiscount - currentPending;
    const newExpectedTotal = amount - newDiscount;

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

    const updatedCharge = await this.prisma.charge.update({
      where: { id },
      data: {
        discountAmount: newDiscount,
        discountReason: addDiscountDto.discountReason,
        pendingAmount: newPending,
        status: newStatus,
      },
      select: chargeSelect,
    });

    return {
      message: 'Descuento agregado exitosamente',
      data: updatedCharge,
    };
  }

  async removeDiscount(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    if (charge.status === StatusCharge.PAID) {
      throw new BadRequestException(
        'No se puede eliminar el descuento de un cargo que ya ha sido pagado',
      );
    }

    const oldDiscount = Number(charge.discountAmount || 0);
    if (oldDiscount === 0) {
      throw new BadRequestException('El cargo no tiene un descuento aplicado');
    }

    const currentPending = Number(charge.pendingAmount || 0);
    const amount = Number(charge.amount);

    const paidAmount = amount - oldDiscount - currentPending;
    const newExpectedTotal = amount; // Sin descuento

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

    const updatedCharge = await this.prisma.charge.update({
      where: { id },
      data: {
        discountAmount: 0,
        discountReason: null,
        pendingAmount: newPending,
        status: newStatus,
      },
      select: chargeSelect,
    });

    return {
      message: 'Descuento eliminado exitosamente',
      data: updatedCharge,
    };
  }
}
