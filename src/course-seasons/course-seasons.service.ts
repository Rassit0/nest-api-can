import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCourseSeasonDto } from './dto/create-course-season.dto';
import { UpdateCourseSeasonDto } from './dto/update-course-season.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CourseSeasonsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const courseSeasonSelect: Prisma.CourseSeasonSelect = {
  id: true,
  imageUrl: true,
  description: true,
  maxMembers: true,
  minMembers: true,
  gender: true,
  billingDay: true,
  registrationFee: true,
  monthlyFee: true,
  debtToleranceMonths: true,
  lateFeeEnabled: true,
  lateFeePerDay: true,
  graceDays: true,
  chargeGenerationDaysBefore: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      school: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  season: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
    },
  },
};

@Injectable()
export class CourseSeasonsService {
  private readonly logger = new Logger('CourseSeasonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseSeasonDto: CreateCourseSeasonDto) {
    const newCourseSeason = await this.prisma.courseSeason.create({
      data: createCourseSeasonDto,
      select: courseSeasonSelect,
    });

    return {
      message: 'Periodo de curso escolar creado exitosamente',
      data: newCourseSeason,
    };
  }

  async findAll(paginationDto: CourseSeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.CourseSeasonWhereInput = {};

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        {
          course: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          category: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          season: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [courseSeasons, totalItems] = await Promise.all([
      this.prisma.courseSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: courseSeasonSelect,
      }),
      this.prisma.courseSeason.count({ where }),
    ]);

    return createPaginationResult(
      courseSeasons,
      totalItems,
      page,
      per_page,
      'Periodos de cursos escolares obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: courseSeasonSelect,
    });
    if (!courseSeason) {
      throw new NotFoundException(
        'El periodo del curso solicitado no fue encontrado',
      );
    }
    return {
      message: 'Periodo del curso obtenido exitosamente',
      data: courseSeason,
    };
  }

  async update(id: string, updateCourseSeasonDto: UpdateCourseSeasonDto) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
    });
    if (!courseSeason) {
      throw new NotFoundException(
        'El periodo del curso solicitado no fue encontrado',
      );
    }

    const updatedCourseSeason = await this.prisma.courseSeason.update({
      where: { id },
      data: updateCourseSeasonDto,
      select: courseSeasonSelect,
    });

    return {
      message: 'Periodo del curso actualizado exitosamente',
      data: updatedCourseSeason,
    };
  }

  async remove(id: string) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
    });
    if (!courseSeason) {
      throw new NotFoundException(
        'El periodo del curso solicitado no fue encontrado',
      );
    }

    const deletedCourseSeason = await this.prisma.courseSeason.delete({
      where: { id },
      select: courseSeasonSelect,
    });

    return {
      message: 'Periodo del curso eliminado exitosamente',
      data: deletedCourseSeason,
    };
  }
}
