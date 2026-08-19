import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, EventType } from 'src/generated/prisma/client';
import { SessionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { EventsService } from 'src/events/events.service';
import { BaseEventCreateDto, BaseEventUpdateDto } from 'src/events/dto/base-event.dto';
import { EventSeriesService } from 'src/events/event-series.service';
import { EventMaterializationService, IEventOccurrenceHandler } from 'src/events/event-materialization.service';

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
      courseSeasonShift: {
        select: {
          shift: { select: { id: true, name: true } },
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
    },
  },
};

@Injectable()
export class SessionsService implements OnModuleInit, IEventOccurrenceHandler {
  private readonly logger = new Logger(SessionsService.name);
  readonly eventType = EventType.SESSION;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly eventSeriesService: EventSeriesService,
    private readonly eventMaterializationService: EventMaterializationService
  ) {}

  onModuleInit() {
    this.eventMaterializationService.registerHandler(this);
  }

  async createOccurrence(tx: Prisma.TransactionClient, eventId: string, templateData: any): Promise<any> {
    const sessionData: Prisma.SessionCreateInput = {
      event: { connect: { id: eventId } },
      ...(templateData.durationMin !== undefined && { durationMin: templateData.durationMin }),
    };

    if (templateData.teamSeasonIds && templateData.teamSeasonIds.length > 0) {
      sessionData.sessionTeams = {
        create: templateData.teamSeasonIds.map((tid: string) => ({ teamSeasonId: tid })),
      };
    }

    if (templateData.courseSeasonShiftIds && templateData.courseSeasonShiftIds.length > 0) {
      sessionData.sessionCourses = {
        create: templateData.courseSeasonShiftIds.map((cid: string) => ({ courseSeasonShiftId: cid })),
      };
    }

    return tx.session.create({
      data: sessionData,
      select: sessionSelect,
    });
  }

  async create(createSessionDto: CreateSessionDto, userId?: string) {
    const {
      teamSeasonIds,
      courseSeasonShiftIds,
      locationId,
      title,
      startDate,
      endDate,
      durationMin,
      recurrenceRule,
    } = createSessionDto;

    const baseData: BaseEventCreateDto = {
      eventType: EventType.SESSION,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      locationId,
      title,
      recurrenceRule,
      timezone: createSessionDto.timezone,
    };

    const createSpecific = async (tx: Prisma.TransactionClient, eventId: string) => {
      return tx.session.create({
        data: {
          eventId,
          durationMin,
          sessionTeams: teamSeasonIds
            ? {
                create: teamSeasonIds.map((id) => ({ teamSeasonId: id })),
              }
            : undefined,
          sessionCourses: courseSeasonShiftIds
            ? {
                create: courseSeasonShiftIds.map((id) => ({ courseSeasonShiftId: id })),
              }
            : undefined,
        },
        select: sessionSelect,
      });
    };

    let data;
    if (recurrenceRule) {
      const { results } = await this.eventSeriesService.createSeries(baseData, createSessionDto, userId, createSpecific);
      data = results.map((r: any) => r.specific);
    } else {
      const result = await this.eventsService.executeEventCreation(baseData, userId, createSpecific);
      data = result.specific;
    }

    return {
      message: recurrenceRule 
        ? 'Serie de sesiones programada exitosamente'
        : 'Sesión de entrenamiento/clase programada exitosamente',
      data, // Returns array if series, object if single
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
              courseSeasonShift: {
                courseSeason: {
                  course: {
                    name: { contains: search, mode: 'insensitive' },
                  },
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

  async update(id: string, updateSessionDto: UpdateSessionDto, userId?: string, scope: 'single' | 'following' | 'all' = 'single') {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { eventId: true, event: { select: { eventSeriesId: true } } }
    });

    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }

    const {
      teamSeasonIds,
      courseSeasonShiftIds,
      locationId,
      title,
      startDate,
      endDate,
      durationMin,
      recurrenceRule,
      timezone,
    } = updateSessionDto;

    const baseDataUpdate: Partial<BaseEventCreateDto> = {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(locationId !== undefined && { locationId }),
      ...(title !== undefined && { title }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
      ...(timezone !== undefined && { timezone }),
    };

    if (session.event.eventSeriesId && scope !== 'single') {
      const mergeTemplate = (oldTemplate: any) => ({
        ...oldTemplate,
        ...(teamSeasonIds !== undefined && { teamSeasonIds }),
        ...(courseSeasonShiftIds !== undefined && { courseSeasonShiftIds }),
        ...(durationMin !== undefined && { durationMin }),
      });

      const occurrenceHandler = async (tx: Prisma.TransactionClient, newEventId: string, mergedTemplate: any) => {
        const sessionData: Prisma.SessionCreateInput = {
          event: { connect: { id: newEventId } },
          ...(mergedTemplate.durationMin !== undefined && { durationMin: mergedTemplate.durationMin }),
        };

        if (mergedTemplate.teamSeasonIds && mergedTemplate.teamSeasonIds.length > 0) {
          sessionData.sessionTeams = {
            create: mergedTemplate.teamSeasonIds.map((tid: string) => ({ teamSeasonId: tid })),
          };
        }

        if (mergedTemplate.courseSeasonShiftIds && mergedTemplate.courseSeasonShiftIds.length > 0) {
          sessionData.sessionCourses = {
            create: mergedTemplate.courseSeasonShiftIds.map((cid: string) => ({ courseSeasonShiftId: cid })),
          };
        }

        return tx.session.create({
          data: sessionData,
          select: sessionSelect,
        });
      };

      return await this.eventSeriesService.updateSeries(id, baseDataUpdate, userId, scope, mergeTemplate, occurrenceHandler);
    }

    const baseData: BaseEventUpdateDto = {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(locationId !== undefined && { locationId }),
      ...(title !== undefined && { title }),
    };

    const result = await this.eventsService.executeEventUpdate(session.eventId, baseData, userId, async (tx) => {
      const sessionData: Prisma.SessionUpdateInput = {
        ...(durationMin !== undefined && { durationMin }),
      };

      if (teamSeasonIds) {
        sessionData.sessionTeams = {
          deleteMany: {},
          create: teamSeasonIds.map((tid) => ({ teamSeasonId: tid })),
        };
      }

      if (courseSeasonShiftIds) {
        sessionData.sessionCourses = {
          deleteMany: {},
          create: courseSeasonShiftIds.map((cid) => ({ courseSeasonShiftId: cid })),
        };
      }

      return tx.session.update({
        where: { id },
        data: sessionData,
        select: sessionSelect,
      });
    });

    return {
      message: 'Sesión actualizada exitosamente',
      data: result.specific,
    };
  }

  async remove(id: string, scope: 'single' | 'following' | 'all' = 'single') {
    const session = await this.prisma.session.findUnique({
      where: { id },
      select: { eventId: true, event: { select: { eventSeriesId: true } } }
    });

    if (!session) {
      throw new NotFoundException('La sesión solicitada no fue encontrada');
    }

    if (session.event.eventSeriesId && scope !== 'single') {
      return await this.eventSeriesService.deleteSeries(id, scope);
    }

    const result = await this.eventsService.executeEventDeletion(session.eventId);

    // After cascading delete from event, return deleted success.
    // We cannot query the session since it was deleted by cascade, so we just return success.
    return {
      message: 'Sesión eliminada exitosamente',
      data: { id },
    };
  }
}
