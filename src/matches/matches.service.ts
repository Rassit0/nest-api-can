import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { AvailabilityEngine } from 'src/events/engines/availability.engine';
import { MatchesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

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
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger('MatchesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityEngine: AvailabilityEngine,
  ) {}

  async create(createMatchDto: CreateMatchDto) {
    const { startDate, endDate, locationId, teamSeasonId, ...matchData } = createMatchDto;
    
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

    const newMatch = await this.prisma.match.create({
      data: {
        ...matchData,
        teamSeason: { connect: { id: teamSeasonId } },
        event: {
          create: {
            startDate,
            endDate,
            eventType: 'MATCH',
            ...(locationId && { locationId }),
          },
        },
      },
      select: matchSelect,
    });

    return {
      message: 'Partido programado exitosamente',
      data: newMatch,
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
          teamSeason: {
            team: {
              name: { contains: search, mode: 'insensitive' },
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

  async update(id: string, updateMatchDto: UpdateMatchDto) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: { eventId: true }
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    const { startDate, endDate, locationId, teamSeasonId, ...matchData } = updateMatchDto;

    if (locationId || startDate || endDate) {
      // Recalculate based on existing data if some are missing
      let checkStartDate = startDate ? new Date(startDate) : undefined;
      let checkEndDate = endDate ? new Date(endDate) : undefined;
      let checkLocationId = locationId;

      if (!checkStartDate || !checkEndDate || !checkLocationId) {
        const existingEvent = await this.prisma.event.findUnique({
          where: { id: match.eventId },
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
          excludeEventId: match.eventId,
        });

        if (isAvailable !== true) {
          throw new BadRequestException(`El horario no está disponible: ${isAvailable.reason}`);
        }
      }
    }

    const updatedMatch = await this.prisma.match.update({
      where: { id },
      data: {
        ...matchData,
        ...(teamSeasonId && { teamSeason: { connect: { id: teamSeasonId } } }),
        event: {
          update: {
            ...(startDate && { startDate }),
            ...(endDate && { endDate }),
            ...(locationId !== undefined ? { locationId } : {}),
          }
        }
      },
      select: matchSelect,
    });

    return {
      message: 'Partido actualizado exitosamente',
      data: updatedMatch,
    };
  }

  async remove(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    const deletedMatch = await this.prisma.match.delete({
      where: { id },
      select: matchSelect,
    });

    return {
      message: 'Partido eliminado exitosamente',
      data: deletedMatch,
    };
  }
}
