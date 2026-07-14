import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
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
  courseSeasonStaffs: true,
  status: true,
  billingConfig: true,
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
    const season = await this.prisma.season.findUnique({
      where: { id: createCourseSeasonDto.seasonId },
    });
    
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    if (createCourseSeasonDto.billingConfig) {
      const { billingFrequency, billingDay } = createCourseSeasonDto.billingConfig;
      if (!billingFrequency || billingFrequency === 'MONTHLY') {
        const diffTime = season.endDate.getTime() - season.startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 28) {
          let isValidDay = false;
          const current = new Date(season.startDate);
          while (current <= season.endDate) {
            if (current.getUTCDate() === billingDay) {
              isValidDay = true;
              break;
            }
            current.setUTCDate(current.getUTCDate() + 1);
          }
          if (!isValidDay) {
            throw new BadRequestException(
              'El día de facturación seleccionado no ocurre dentro de las fechas de esta temporada.',
            );
          }
        }
      }
    }

    const { billingConfig, ...courseSeasonData } = createCourseSeasonDto;
    const newCourseSeason = await this.prisma.courseSeason.create({
      data: {
        ...courseSeasonData,
        ...(billingConfig ? { billingConfig: { create: billingConfig } } : {}),
      },
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

    const seasonId = updateCourseSeasonDto.seasonId ?? courseSeason.seasonId;
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });
    
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    // TODO: implement validation for billingConfig update here if needed.
    // For now we'll just upsert it in Prisma.

    const { billingConfig, ...courseSeasonData } = updateCourseSeasonDto;
    const updatedCourseSeason = await this.prisma.courseSeason.update({
      where: { id },
      data: {
        ...courseSeasonData,
        ...(billingConfig ? {
          billingConfig: {
            upsert: {
              create: billingConfig,
              update: billingConfig,
            }
          }
        } : {}),
      },
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

  async toggleBillingEngine(id: string, isEngineActive: boolean) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      include: { billingConfig: true },
    });
    if (!courseSeason || !courseSeason.billingConfig) {
      throw new NotFoundException(
        'La configuración de cobros para este periodo de curso no fue encontrada',
      );
    }

    const updated = await this.prisma.courseSeasonBillingConfig.update({
      where: { courseSeasonId: id },
      data: { isEngineActive },
    });

    return {
      message: `Motor de cobros ${isEngineActive ? 'activado' : 'pausado'} exitosamente`,
      data: updated,
    };
  }

  async getPauses(courseSeasonId: string) {
    const pauses = await this.prisma.courseSeasonPause.findMany({
      where: { courseSeasonId },
      orderBy: { startDate: 'desc' },
    });
    return { data: pauses, message: 'Pausas obtenidas' };
  }

  async addPause(
    courseSeasonId: string,
    createPauseDto: { startDate: string; endDate: string; reason?: string },
  ) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id: courseSeasonId },
      include: { season: true },
    });

    if (!courseSeason) throw new BadRequestException('Course season not found');

    const startDate = new Date(createPauseDto.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(createPauseDto.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    if (startDate > endDate) {
      throw new BadRequestException('La fecha de inicio debe ser anterior o igual a la de fin');
    }

    if (startDate < courseSeason.season.startDate || endDate > courseSeason.season.endDate) {
      throw new BadRequestException(
        `Las fechas de la pausa deben estar dentro del rango de la temporada (${courseSeason.season.startDate.toISOString().split('T')[0]} - ${courseSeason.season.endDate.toISOString().split('T')[0]})`,
      );
    }

    const overlapping = await this.prisma.courseSeasonPause.findFirst({
      where: {
        courseSeasonId,
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Ya existe una pausa para este curso en estas fechas (${overlapping.startDate.toISOString().split('T')[0]} - ${overlapping.endDate.toISOString().split('T')[0]})`,
      );
    }

    const pause = await this.prisma.courseSeasonPause.create({
      data: {
        courseSeasonId,
        startDate,
        endDate,
        reason: createPauseDto.reason,
      },
    });

    return { message: 'Pausa agregada correctamente', data: pause };
  }

  async removePause(id: string) {
    const pause = await this.prisma.courseSeasonPause.findUnique({
      where: { id },
    });
    if (!pause) throw new BadRequestException('Pausa no encontrada');

    await this.prisma.courseSeasonPause.delete({
      where: { id },
    });

    return { message: 'Pausa eliminada correctamente' };
  }
}
