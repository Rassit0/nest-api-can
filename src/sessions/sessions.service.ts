import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { AvailabilityEngine } from 'src/events/engines/availability.engine';
import { SessionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const sessionSelect: Prisma.SessionSelect = {
  id: true,
  durationMin: true,
  event: {
    select: {
      title: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      location: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    }
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityEngine: AvailabilityEngine,
  ) {}

  async create(createSessionDto: CreateSessionDto) {
    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      title,
      startDate,
      endDate,
      durationMin,
    } = createSessionDto;

    if (locationId) {
      const isAvailable = await this.availabilityEngine.checkAvailability({
        locationId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      if (isAvailable !== true) {
        throw new BadRequestException(`El horario no está disponible: ${isAvailable.reason}`);
      }
    }

    const newSession = await this.prisma.session.create({
      data: {
        durationMin,
        event: {
          create: {
            title,
            startDate,
            endDate,
            eventType: 'SESSION',
            ...(locationId && { locationId }),
          },
        },
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
      sortField = 'startDate',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.SessionWhereInput = {};

    if (search) {
      where.OR = [
        { event: { title: { contains: search, mode: 'insensitive' } } },
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
        {
          event: {
            location: {
              name: { contains: search, mode: 'insensitive' },
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
        orderBy: sortField === 'startDate' ? { event: { startDate: orderBy } } : { [sortField]: orderBy },
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
      select: { eventId: true }
    });

    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }

    const {
      teamSeasonIds,
      courseSeasonIds,
      locationId,
      title,
      startDate,
      endDate,
      durationMin,
    } = updateSessionDto;

    if (locationId || startDate || endDate) {
      // Recalculate based on existing data if some are missing
      let checkStartDate = startDate ? new Date(startDate) : undefined;
      let checkEndDate = endDate ? new Date(endDate) : undefined;
      let checkLocationId = locationId;

      if (!checkStartDate || !checkEndDate || !checkLocationId) {
        const existingEvent = await this.prisma.event.findUnique({
          where: { id: session.eventId },
          select: { startDate: true, endDate: true, locationId: true }
        });
        checkStartDate = checkStartDate || existingEvent?.startDate;
        checkEndDate = checkEndDate || existingEvent?.endDate;
        checkLocationId = checkLocationId || existingEvent?.locationId;
      }

      if (checkLocationId && checkStartDate && checkEndDate) {
        const isAvailable = await this.availabilityEngine.checkAvailability({
          locationId: checkLocationId,
          startDate: checkStartDate,
          endDate: checkEndDate,
          excludeEventId: session.eventId,
        });

        if (isAvailable !== true) {
          throw new BadRequestException(`El horario no está disponible: ${isAvailable.reason}`);
        }
      }
    }

    const sessionData: Prisma.SessionUpdateInput = {
      durationMin,
      event: {
        update: {
          ...(title !== undefined && { title }),
          ...(startDate !== undefined && { startDate }),
          ...(endDate !== undefined && { endDate }),
          ...(locationId !== undefined ? { locationId } : {}),
        }
      }
    };

    if (teamSeasonIds) {
      sessionData.sessionTeams = {
        deleteMany: {},
        create: teamSeasonIds.map((tid) => ({ teamSeasonId: tid })),
      };
    }

    if (courseSeasonIds) {
      sessionData.sessionCourses = {
        deleteMany: {},
        create: courseSeasonIds.map((cid) => ({ courseSeasonId: cid })),
      };
    }

    const updatedSession = await this.prisma.session.update({
      where: { id },
      data: sessionData,
      select: sessionSelect,
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
