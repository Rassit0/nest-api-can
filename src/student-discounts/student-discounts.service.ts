import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentDiscountDto } from './dto/create-student-discount.dto';
import { UpdateStudentDiscountDto } from './dto/update-student-discount.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { StudentDiscountsPaginationDto } from './dto/pagination.dto';
import { StudentChargesService } from 'src/student-charges/student-charges.service';

export const studentDiscountSelect: Prisma.StudentDiscountSelect = {
  id: true,
  studentMembershipId: true,
  recurringDiscountPercent: true,
  registrationDiscountPercent: true,
  startDate: true,
  endDate: true,
  type: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class StudentDiscountsService {
  private readonly logger = new Logger('StudentDiscountsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentChargesService: StudentChargesService,
  ) {}

  async create(createStudentDiscountDto: CreateStudentDiscountDto) {
    const studentMembership =
      await this.getStudentMembershipWithOfferingWithSeason(
        createStudentDiscountDto.studentMembershipId,
      );

    if (
      studentMembership.status === 'WITHDRAWN' ||
      studentMembership.status === 'FINISHED'
    ) {
      throw new BadRequestException(
        'No se pueden asignar descuentos a membresías finalizadas o retiradas',
      );
    }

    this.validateDiscountRangeDate(
      new Date(createStudentDiscountDto.startDate),
      createStudentDiscountDto.endDate
        ? new Date(createStudentDiscountDto.endDate)
        : null,
      studentMembership.courseSeason.season.startDate,
      studentMembership.courseSeason.season.endDate,
    );

    await this.validateOverlappingDiscount(
      createStudentDiscountDto.studentMembershipId,
      new Date(createStudentDiscountDto.startDate),
      createStudentDiscountDto.endDate
        ? new Date(createStudentDiscountDto.endDate)
        : null,
    );

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
      studentMembershipId,
      type,
    } = paginationDto;

    const skip = (page - 1) * per_page;
    const where: Prisma.StudentDiscountWhereInput = {};

    if (studentMembershipId) {
      where.studentMembershipId = studentMembershipId;
    }

    if (type) {
      where.type = type;
    }

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

    const totalPages = Math.ceil(totalItems / per_page);
    const currentPage = page;

    return {
      message: 'Descuentos escolares obtenidos exitosamente',
      data: discounts,
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
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
    const discount = await this.getStudentDiscount(id);

    const startDate = updateStudentDiscountDto.startDate
      ? new Date(updateStudentDiscountDto.startDate)
      : discount.startDate;

    const endDate =
      updateStudentDiscountDto.endDate !== undefined
        ? updateStudentDiscountDto.endDate
          ? new Date(updateStudentDiscountDto.endDate)
          : null
        : discount.endDate;

    const studentMembership =
      await this.getStudentMembershipWithOfferingWithSeason(
        discount.studentMembershipId,
      );

    if (
      studentMembership.status === 'WITHDRAWN' ||
      studentMembership.status === 'FINISHED'
    ) {
      throw new BadRequestException(
        'No se pueden modificar descuentos de membresías finalizadas o retiradas',
      );
    }

    this.validateDiscountRangeDate(
      startDate,
      endDate,
      studentMembership.courseSeason.season.startDate,
      studentMembership.courseSeason.season.endDate,
    );

    await this.validateOverlappingDiscount(
      discount.studentMembershipId,
      startDate,
      endDate,
      id,
    );

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
    const discount = await this.getStudentDiscount(id);

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

  async finish(id: string) {
    const discount = await this.getStudentDiscount(id);

    const now = new Date();

    if (discount.endDate && discount.endDate <= now) {
      throw new BadRequestException('El descuento ya se encuentra finalizado');
    }

    if (now <= discount.startDate) {
      throw new BadRequestException(
        'No se puede finalizar un descuento antes de que inicie',
      );
    }

    const finishedStudentDiscount =
      await this.prisma.studentDiscount.update({
        where: { id },
        data: { endDate: now },
        select: studentDiscountSelect,
      });

    this.studentChargesService.recalculatePendingFutureCharges(discount.studentMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras finalizar descuento en membresía ${discount.studentMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento finalizado exitosamente',
      data: finishedStudentDiscount,
    };
  }

  private async getStudentMembershipWithOfferingWithSeason(id: string) {
    const studentMembership = await this.prisma.studentMembership.findUnique({
      where: { id },
      include: {
        courseSeason: {
          select: {
            season: {
              select: {
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!studentMembership) {
      throw new NotFoundException('La membresía no fué encontrada');
    }

    return studentMembership;
  }

  private async getStudentDiscount(id: string) {
    const discount = await this.prisma.studentDiscount.findUnique({
      where: { id },
    });

    if (!discount) {
      throw new NotFoundException('El descuento solicitado no fue encontrado');
    }
    return discount;
  }

  private validateDiscountRangeDate(
    startDate: Date,
    endDate: Date | null,
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    if (startDate < seasonStartDate || startDate > seasonEndDate) {
      throw new BadRequestException(
        `La fecha de inicio del descuento debe estar dentro de la temporada (${seasonStartDate.toISOString()} - ${seasonEndDate.toISOString()})`,
      );
    }

    if (endDate && (endDate < seasonStartDate || endDate > seasonEndDate)) {
      throw new BadRequestException(
        `La fecha de finalización del descuento debe estar dentro de la temporada (${seasonStartDate.toISOString()} - ${seasonEndDate.toISOString()})`,
      );
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio',
      );
    }
  }

  private async validateOverlappingDiscount(
    studentMembershipId: string,
    startDate: Date,
    endDate: Date | null,
    id?: string,
  ) {
    const effectiveEndDate = endDate ?? new Date('9999-12-31');

    const overlappingDiscount = await this.prisma.studentDiscount.findFirst({
      where: {
        ...(id && {
          NOT: {
            id,
          },
        }),
        studentMembershipId,
        startDate: {
          lte: effectiveEndDate,
        },
        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
    });

    if (overlappingDiscount) {
      throw new BadRequestException(
        'Ya existe un descuento activo en el rango de fechas especificado',
      );
    }
  }
}
