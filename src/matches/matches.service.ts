import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, EventType, EventStatus, TeamSeasonCategoryStatus, StatusTeamSeason, SeasonStatus } from 'src/generated/prisma/client';
import { MatchesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { EventsService } from 'src/events/events.service';
import { BaseEventCreateDto, BaseEventUpdateDto } from 'src/events/dto/base-event.dto';

export const matchSelect: Prisma.MatchSelect = {
  id: true,
  opponentName: true,
  type: true,
  ourScore: true,
  theirScore: true,
  result: true,
  event: {
    select: {
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
    },
  },
  teamSeasonCategory: {
    select: {
      id: true,
      gender: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      teamSeason: {
        select: {
          id: true,
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
        },
      },
    },
  },
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger('MatchesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async create(createMatchDto: CreateMatchDto, userId?: string) {
    const { startDate, endDate, locationId, teamSeasonCategoryId, ...matchData } = createMatchDto;


    const baseData: BaseEventCreateDto = {
      eventType: EventType.MATCH,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      locationId,
    };

    const result = await this.eventsService.executeEventCreation(baseData, userId, async (tx, eventId) => {
      return tx.match.create({
        data: {
          ...matchData,
          eventId,
          teamSeasonCategoryId,
        },
        select: matchSelect,
      });
    });

    return {
      message: 'Partido programado exitosamente',
      data: result.specific,
    };
  }

  async findAll(paginationDto: MatchesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'startDate',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.MatchWhereInput = {};

    if (search) {
      where.OR = [
        { opponentName: { contains: search, mode: 'insensitive' } },
        {
          teamSeasonCategory: {
            teamSeason: {
              team: {
                name: { contains: search, mode: 'insensitive' },
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

    const [matches, totalItems] = await Promise.all([
      this.prisma.match.findMany({
        where,
        take: per_page,
        skip,
        orderBy: sortField === 'startDate' ? { event: { startDate: orderBy } } : { [sortField]: orderBy },
        select: matchSelect,
      }),
      this.prisma.match.count({ where }),
    ]);

    return createPaginationResult(
      matches,
      totalItems,
      page,
      per_page,
      'Partidos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: matchSelect,
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }
    return {
      message: 'Partido obtenido exitosamente',
      data: match,
    };
  }

  async update(id: string, updateMatchDto: UpdateMatchDto, userId?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: { eventId: true }
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    const { startDate, endDate, locationId, teamSeasonCategoryId, ...matchData } = updateMatchDto;

    const baseData: BaseEventUpdateDto = {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(locationId !== undefined && { locationId }),
    };

    let updateCategoryData = {};
    if (teamSeasonCategoryId) {
      updateCategoryData = {
        teamSeasonCategory: { connect: { id: teamSeasonCategoryId } },
      };
    }

    const result = await this.eventsService.executeEventUpdate(match.eventId, baseData, userId, async (tx) => {
      return tx.match.update({
        where: { id },
        data: {
          ...matchData,
          ...updateCategoryData,
        },
        select: matchSelect,
      });
    });

    return {
      message: 'Partido actualizado exitosamente',
      data: result.specific,
    };
  }

  async remove(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    await this.eventsService.executeEventDeletion(match.eventId);

    return {
      message: 'Partido eliminado exitosamente',
      data: { id },
    };
  }
  async findPublicFixture() {
    const commonWhere = {
      teamSeasonCategory: {
        status: TeamSeasonCategoryStatus.ACTIVE,
        teamSeason: {
          status: StatusTeamSeason.ACTIVE,
          season: {
            status: SeasonStatus.ACTIVE,
          },
        },
      },
    };

    const publicSelect = {
      id: true,
      opponentName: true,
      ourScore: true,
      theirScore: true,
      result: true,
      event: {
        select: {
          startDate: true,
          status: true,
          location: {
            select: { name: true },
          },
        },
      },
      teamSeasonCategory: {
        select: {
          category: { select: { name: true } },
          teamSeason: {
            select: {
              team: {
                select: {
                  name: true,
                  imageUrl: true,
                  club: {
                    select: {
                      discipline: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const [recentMatches, upcomingMatches] = await Promise.all([
      // Resultados recientes
      this.prisma.match.findMany({
        where: {
          ...commonWhere,
          event: {
            startDate: { lt: new Date() },
            status: EventStatus.COMPLETED,
          },
        },
        orderBy: { event: { startDate: 'desc' } },
        take: 6,
        select: publicSelect,
      }),
      // Próximos partidos
      this.prisma.match.findMany({
        where: {
          ...commonWhere,
          event: {
            startDate: { gte: new Date() },
            status: EventStatus.SCHEDULED,
          },
        },
        orderBy: { event: { startDate: 'asc' } },
        take: 6,
        select: publicSelect,
      }),
    ]);

    const formatMatch = (match: any) => ({
      id: match.id,
      category: match.teamSeasonCategory?.category?.name || 'General',
      locationName: match.event?.location?.name || 'Sede CAN',
      date: match.event?.startDate?.toISOString() || new Date().toISOString(),
      homeTeam: {
        name: match.teamSeasonCategory?.teamSeason?.team?.name || 'CAN',
        imageUrl: match.teamSeasonCategory?.teamSeason?.team?.imageUrl || null,
      },
      awayTeam: {
        name: match.opponentName,
      },
      ourScore: match.ourScore,
      theirScore: match.theirScore,
      status: match.event?.status === EventStatus.COMPLETED ? 'PLAYED' : 'PENDING',
      discipline: match.teamSeasonCategory?.teamSeason?.team?.club?.discipline?.name || 'Deporte',
    });

    const data = [
      ...recentMatches.map(formatMatch),
      ...upcomingMatches.map(formatMatch),
    ];

    return {
      message: 'Fixture público obtenido exitosamente',
      data,
    };
  }
}
