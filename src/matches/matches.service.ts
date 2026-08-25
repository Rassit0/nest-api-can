import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, EventType } from 'src/generated/prisma/client';
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
}
