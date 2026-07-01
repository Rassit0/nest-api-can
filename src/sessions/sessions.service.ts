import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { SessionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const sessionSelect: Prisma.SessionSelect = {
  id: true,
  title: true,
  dateTime: true,
  durationMin: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
  sessionTeams: {
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
  sessionCourses: {
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
export class SessionsService {
  private readonly logger = new Logger('SessionsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createSessionDto: CreateSessionDto) {
    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      title,
      dateTime,
      durationMin,
    } = createSessionDto;

    const newSession = await this.prisma.session.create({
      data: {
        title,
        dateTime,
        durationMin,
        locationId,
        sessionTeams: teamSeasonIds
          ? {
              create: teamSeasonIds.map((id) => ({ teamSeasonId: id })),
            }
          : undefined,
        sessionCourses: courseSeasonIds
          ? {
              create: courseSeasonIds.map((id) => ({ courseSeasonId: id })),
            }
          : undefined,
      },
      select: sessionSelect,
    });

    return {
      message: 'Sesión de entrenamiento/clase programada exitosamente',
      data: newSession,
    };
  }

  async findAll(paginationDto: SessionsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'dateTime',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SessionWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        {
          location: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          sessionTeams: {
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
          sessionCourses: {
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

    const [sessions, totalItems] = await Promise.all([
      this.prisma.session.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: sessionSelect,
      }),
      this.prisma.session.count({ where }),
    ]);

    return createPaginationResult(
      sessions,
      totalItems,
      page,
      per_page,
      'Sesiones obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: sessionSelect,
    });
    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }
    return {
      message: 'Sesión obtenida exitosamente',
      data: session,
    };
  }

  async update(id: string, updateSessionDto: UpdateSessionDto) {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }

    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      title,
      dateTime,
      durationMin,
    } = updateSessionDto;

    const updatedSession = await this.prisma.$transaction(async (tx) => {
      // Si se provee teamSeasonIds, limpiar y regenerar
      if (teamSeasonIds !== undefined) {
        await tx.sessionTeam.deleteMany({ where: { sessionId: id } });
        if (teamSeasonIds) {
          await tx.sessionTeam.createMany({
            data: teamSeasonIds.map((teamSeasonId) => ({
              sessionId: id,
              teamSeasonId,
            })),
          });
        }
      }

      // Si se provee courseSeasonIds, limpiar y regenerar
      if (courseSeasonIds !== undefined) {
        await tx.sessionCourse.deleteMany({ where: { sessionId: id } });
        if (courseSeasonIds) {
          await tx.sessionCourse.createMany({
            data: courseSeasonIds.map((courseSeasonId) => ({
              sessionId: id,
              courseSeasonId,
            })),
          });
        }
      }

      return await tx.session.update({
        where: { id },
        data: {
          title,
          dateTime,
          durationMin,
          locationId,
        },
        select: sessionSelect,
      });
    });

    return {
      message: 'Sesión actualizada exitosamente',
      data: updatedSession,
    };
  }

  async remove(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }

    const deletedSession = await this.prisma.session.delete({
      where: { id },
      select: sessionSelect,
    });

    return {
      message: 'Sesión eliminada exitosamente',
      data: deletedSession,
    };
  }
}
