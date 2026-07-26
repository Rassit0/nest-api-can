import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { ShiftsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const shiftSelect: Prisma.ShiftSelect = {
  id: true,
  name: true,
  institution: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger('ShiftsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createShiftDto: CreateShiftDto) {
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    const newShift = await this.prisma.shift.create({
      data: {
        ...createShiftDto,
        institutionId: institution.id,
      },
      select: shiftSelect,
    });

    return {
      message: 'Turno agregado exitosamente',
      data: newShift,
    };
  }

  async findAll(paginationDto: ShiftsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      institutionId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.ShiftWhereInput = search
      ? {
          OR: [{ name: { contains: search, mode: 'insensitive' } }],
        }
      : {};

    if (institutionId) {
      where.institutionId = institutionId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [shifts, totalItems] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: shiftSelect,
      }),
      this.prisma.shift.count({ where }),
    ]);

    return createPaginationResult(
      shifts,
      totalItems,
      page,
      per_page,
      'Turnos obtenidos exitosamente',
    );
  }

  async findAllUnpaginated() {
    const shifts = await this.prisma.shift.findMany({
      select: shiftSelect,
      orderBy: { name: 'asc' },
    });
    return {
      data: shifts,
      message: 'Turnos obtenidos exitosamente',
    };
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: shiftSelect,
    });
    if (!shift) {
      throw new NotFoundException('El turno no fue encontrado');
    }
    return {
      data: shift,
      message: 'Turno obtenido exitosamente',
    };
  }

  async update(id: string, updateShiftDto: UpdateShiftDto) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: shiftSelect,
    });
    if (!shift) {
      throw new NotFoundException('El turno no fue encontrado');
    }
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    const updatedShift = await this.prisma.shift.update({
      where: { id },
      data: {
        ...updateShiftDto,
        institutionId: institution.id,
      },
      select: shiftSelect,
    });
    return {
      message: 'Turno actualizado exitosamente',
      data: updatedShift,
    };
  }

  async remove(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      select: shiftSelect,
    });
    if (!shift) {
      throw new NotFoundException('El turno no fue encontrado');
    }
    const deletedShift = await this.prisma.shift.delete({
      where: { id },
      select: shiftSelect,
    });
    return {
      message: 'Turno eliminado exitosamente',
      data: deletedShift,
    };
  }
}
