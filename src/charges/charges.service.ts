import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { UpdateChargeDto } from './dto/update-charge.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { ChargesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const chargeSelect: Prisma.ChargeSelect = {
  id: true,
  description: true,
  amount: true,
  pendingAmount: true,
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
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const { parentChargeId, ...rest } = updateChargeDto;
    const data: Prisma.ChargeUpdateInput = { ...rest };

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
    });
    if (!charge) {
      throw new NotFoundException('El cargo solicitado no fue encontrado');
    }

    const deletedCharge = await this.prisma.charge.delete({
      where: { id },
      select: chargeSelect,
    });

    return {
      message: 'Cargo eliminado exitosamente',
      data: deletedCharge,
    };
  }
}
