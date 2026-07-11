import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';
import { UpdateStudentDiscountDto } from './dto/update-student-discount.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { StudentDiscountsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const studentDiscountSelect: Prisma.StudentDiscountSelect = {
  id: true,
  recurringDiscountPercent: true,
  registrationDiscountPercent: true,
  startDate: true,
  endDate: true,
  type: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
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
            },
          },
        },
      },
      courseSeason: {
        select: {
          id: true,
          course: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
};

import { StudentChargesService } from 'src/student-charges/student-charges.service';

@Injectable()
export class StudentDiscountsService {
  private readonly logger = new Logger('StudentDiscountsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentChargesService: StudentChargesService,
  ) {}

  async create(createStudentDiscountDto: CreateStudentDiscountDto) {
    const newDiscount = await this.prisma.studentDiscount.create({
      data: createStudentDiscountDto,
      select: studentDiscountSelect,
    });

    this.studentChargesService.recalculatePendingFutureCharges(createStudentDiscountDto.studentMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras asignar descuento escolar a membresía ${createStudentDiscountDto.studentMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento escolar registrado exitosamente',
      data: newDiscount,
    };
  }

  async findAll(paginationDto: StudentDiscountsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.StudentDiscountWhereInput = {};

    if (search) {
      where.OR = [
        { reason: { contains: search, mode: 'insensitive' } },
        {
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
      ];
    }

    const [discounts, totalItems] = await Promise.all([
      this.prisma.studentDiscount.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: studentDiscountSelect,
      }),
      this.prisma.studentDiscount.count({ where }),
    ]);

    return createPaginationResult(
      discounts,
      totalItems,
      page,
      per_page,
      'Descuentos escolares obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const discount = await this.prisma.studentDiscount.findUnique({
      where: { id },
      select: studentDiscountSelect,
    });
    if (!discount) {
      throw new NotFoundException('El descuento solicitado no fue encontrado');
    }
    return {
      message: 'Descuento obtenido exitosamente',
      data: discount,
    };
  }

  async update(id: string, updateStudentDiscountDto: UpdateStudentDiscountDto) {
    const discount = await this.prisma.studentDiscount.findUnique({
      where: { id },
    });
    if (!discount) {
      throw new NotFoundException('El descuento solicitado no fue encontrado');
    }

    const updatedDiscount = await this.prisma.studentDiscount.update({
      where: { id },
      data: updateStudentDiscountDto,
      select: studentDiscountSelect,
    });

    this.studentChargesService.recalculatePendingFutureCharges(discount.studentMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras actualizar descuento escolar en membresía ${discount.studentMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento actualizado exitosamente',
      data: updatedDiscount,
    };
  }

  async remove(id: string) {
    const discount = await this.prisma.studentDiscount.findUnique({
      where: { id },
    });
    if (!discount) {
      throw new NotFoundException('El descuento solicitado no fue encontrado');
    }

    const deletedDiscount = await this.prisma.studentDiscount.delete({
      where: { id },
      select: studentDiscountSelect,
    });

    this.studentChargesService.recalculatePendingFutureCharges(discount.studentMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras eliminar descuento escolar en membresía ${discount.studentMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento eliminado de la membresía exitosamente',
      data: deletedDiscount,
    };
  }
}
