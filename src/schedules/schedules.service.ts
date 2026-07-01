import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { SchedulesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const scheduleSelect: Prisma.ScheduleSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  scheduleTeams: {
    select: {
      teamSeason: {
        select: {
          id: true,
          gender: true,
          team: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  scheduleCourses: {
    select: {
      courseSeason: {
        select: {
          id: true,
          gender: true,
          course: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
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

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger('SchedulesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createScheduleDto: CreateScheduleDto) {
    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      dayOfWeek,
      startTime,
      endTime,
    } = createScheduleDto;

    const newSchedule = await this.prisma.schedule.create({
      data: {
        dayOfWeek,
        startTime,
        endTime,
        locationId,
        scheduleTeams: teamSeasonIds
          ? {
              create: teamSeasonIds.map((id) => ({ teamSeasonId: id })),
            }
          : undefined,
        scheduleCourses: courseSeasonIds
          ? {
              create: courseSeasonIds.map((id) => ({ courseSeasonId: id })),
            }
          : undefined,
      },
      select: scheduleSelect,
    });

    return {
      message: 'Horario programado exitosamente',
      data: newSchedule,
    };
  }

  async findAll(paginationDto: SchedulesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'dayOfWeek',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.ScheduleWhereInput = {};

    if (search) {
      where.OR = [
        {
          location: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          scheduleTeams: {
            some: {
              teamSeason: {
                team: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            },
          },
        },
        {
          scheduleCourses: {
            some: {
              courseSeason: {
                course: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
            },
          },
        },
      ];
    }

    const [schedules, totalItems] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: scheduleSelect,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return createPaginationResult(
      schedules,
      totalItems,
      page,
      per_page,
      'Horarios obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      select: scheduleSelect,
    });
    if (!schedule) {
      throw new NotFoundException('El horario solicitado no fue encontrado');
    }
    return {
      message: 'Horario obtenido exitosamente',
      data: schedule,
    };
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });
    if (!schedule) {
      throw new NotFoundException('El horario solicitado no fue encontrado');
    }

    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      dayOfWeek,
      startTime,
      endTime,
    } = updateScheduleDto;

    const updatedSchedule = await this.prisma.$transaction(async (tx) => {
      // Si se provee teamSeasonIds, limpiar y regenerar
      if (teamSeasonIds !== undefined) {
        await tx.scheduleTeam.deleteMany({ where: { scheduleId: id } });
        if (teamSeasonIds) {
          await tx.scheduleTeam.createMany({
            data: teamSeasonIds.map((teamSeasonId) => ({
              scheduleId: id,
              teamSeasonId,
            })),
          });
        }
      }

      // Si se provee courseSeasonIds, limpiar y regenerar
      if (courseSeasonIds !== undefined) {
        await tx.scheduleCourse.deleteMany({ where: { scheduleId: id } });
        if (courseSeasonIds) {
          await tx.scheduleCourse.createMany({
            data: courseSeasonIds.map((courseSeasonId) => ({
              scheduleId: id,
              courseSeasonId,
            })),
          });
        }
      }

      return await tx.schedule.update({
        where: { id },
        data: {
          dayOfWeek,
          startTime,
          endTime,
          locationId,
        },
        select: scheduleSelect,
      });
    });

    return {
      message: 'Horario actualizado exitosamente',
      data: updatedSchedule,
    };
  }

  async remove(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });
    if (!schedule) {
      throw new NotFoundException('El horario solicitado no fue encontrado');
    }

    const deletedSchedule = await this.prisma.schedule.delete({
      where: { id },
      select: scheduleSelect,
    });

    return {
      message: 'Horario eliminado exitosamente',
      data: deletedSchedule,
    };
  }
}
