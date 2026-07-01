import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCourseSeasonStaffDto } from './dto/create-course-season-staff.dto';
import { UpdateCourseSeasonStaffDto } from './dto/update-course-season-staff.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CourseSeasonStaffPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const courseSeasonStaffSelect: Prisma.CourseSeasonStaffSelect = {
  id: true,
  role: true,
  customRole: true,
  startedAt: true,
  endedAt: true,
  isPrimary: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
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
  staff: {
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
};

@Injectable()
export class CourseSeasonStaffService {
  private readonly logger = new Logger('CourseSeasonStaffService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseSeasonStaffDto: CreateCourseSeasonStaffDto) {
    const { courseSeasonId, isPrimary } = createCourseSeasonStaffDto;

    const newStaffAssoc = await this.prisma.$transaction(async (tx) => {
      // Si se marca como primario, remover la bandera de los demás
      if (isPrimary) {
        await tx.courseSeasonStaff.updateMany({
          where: { courseSeasonId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return await tx.courseSeasonStaff.create({
        data: createCourseSeasonStaffDto,
        select: courseSeasonStaffSelect,
      });
    });

    return {
      message: 'Personal asignado al curso escolar exitosamente',
      data: newStaffAssoc,
    };
  }

  async findAll(paginationDto: CourseSeasonStaffPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'startedAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.CourseSeasonStaffWhereInput = {};

    if (search) {
      where.OR = [
        { customRole: { contains: search, mode: 'insensitive' } },
        {
          staff: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          courseSeason: {
            course: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [staffs, totalItems] = await Promise.all([
      this.prisma.courseSeasonStaff.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: courseSeasonStaffSelect,
      }),
      this.prisma.courseSeasonStaff.count({ where }),
    ]);

    return createPaginationResult(
      staffs,
      totalItems,
      page,
      per_page,
      'Asignaciones de personal de cursos obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const staffAssoc = await this.prisma.courseSeasonStaff.findUnique({
      where: { id },
      select: courseSeasonStaffSelect,
    });
    if (!staffAssoc) {
      throw new NotFoundException(
        'La asignación de personal solicitada no fue encontrada',
      );
    }
    return {
      message: 'Asignación de personal obtenida exitosamente',
      data: staffAssoc,
    };
  }

  async update(
    id: string,
    updateCourseSeasonStaffDto: UpdateCourseSeasonStaffDto,
  ) {
    const staffAssoc = await this.prisma.courseSeasonStaff.findUnique({
      where: { id },
    });
    if (!staffAssoc) {
      throw new NotFoundException(
        'La asignación de personal solicitada no fue encontrada',
      );
    }

    const { courseSeasonId, isPrimary } = updateCourseSeasonStaffDto;
    const finalCourseSeasonId = courseSeasonId || staffAssoc.courseSeasonId;

    const updatedStaffAssoc = await this.prisma.$transaction(async (tx) => {
      // Si se actualiza a primario, limpiar los otros
      if (isPrimary === true) {
        await tx.courseSeasonStaff.updateMany({
          where: { courseSeasonId: finalCourseSeasonId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return await tx.courseSeasonStaff.update({
        where: { id },
        data: updateCourseSeasonStaffDto,
        select: courseSeasonStaffSelect,
      });
    });

    return {
      message: 'Asignación de personal actualizada exitosamente',
      data: updatedStaffAssoc,
    };
  }

  async remove(id: string) {
    const staffAssoc = await this.prisma.courseSeasonStaff.findUnique({
      where: { id },
    });
    if (!staffAssoc) {
      throw new NotFoundException(
        'La asignación de personal solicitada no fue encontrada',
      );
    }

    const deletedStaffAssoc = await this.prisma.courseSeasonStaff.delete({
      where: { id },
      select: courseSeasonStaffSelect,
    });

    return {
      message: 'Asignación de personal eliminada de la temporada exitosamente',
      data: deletedStaffAssoc,
    };
  }
}
