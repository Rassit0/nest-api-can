import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMatchLineupDto } from './dto/create-match-lineup.dto';
import { UpdateMatchLineupDto } from './dto/update-match-lineup.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { MatchLineupsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const matchLineupSelect: Prisma.MatchLineupSelect = {
  id: true,
  minutesPlayed: true,
  goals: true,
  assists: true,
  yellowCards: true,
  redCards: true,
  isStarter: true,
  createdAt: true,
  updatedAt: true,
  match: {
    select: {
      id: true,
      opponentName: true,
      matchDate: true,
      type: true,
    },
  },
  player: {
    select: {
      id: true,
      isActive: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
          secondLastName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
};

@Injectable()
export class MatchLineupsService {
  private readonly logger = new Logger('MatchLineupsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createMatchLineupDto: CreateMatchLineupDto) {
    const newLineup = await this.prisma.matchLineup.create({
      data: createMatchLineupDto,
      select: matchLineupSelect,
    });

    return {
      message: 'Jugador convocado al partido exitosamente',
      data: newLineup,
    };
  }

  async findAll(paginationDto: MatchLineupsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.MatchLineupWhereInput = {};

    if (search) {
      where.OR = [
        {
          player: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          match: {
            opponentName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [lineups, totalItems] = await Promise.all([
      this.prisma.matchLineup.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: matchLineupSelect,
      }),
      this.prisma.matchLineup.count({ where }),
    ]);

    return createPaginationResult(
      lineups,
      totalItems,
      page,
      per_page,
      'Convocatorias de partido obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const lineup = await this.prisma.matchLineup.findUnique({
      where: { id },
      select: matchLineupSelect,
    });
    if (!lineup) {
      throw new NotFoundException(
        'La convocatoria solicitada no fue encontrada',
      );
    }
    return {
      message: 'Convocatoria de partido obtenida exitosamente',
      data: lineup,
    };
  }

  async update(id: string, updateMatchLineupDto: UpdateMatchLineupDto) {
    const lineup = await this.prisma.matchLineup.findUnique({
      where: { id },
    });
    if (!lineup) {
      throw new NotFoundException(
        'La convocatoria solicitada no fue encontrada',
      );
    }

    const updatedLineup = await this.prisma.matchLineup.update({
      where: { id },
      data: updateMatchLineupDto,
      select: matchLineupSelect,
    });

    return {
      message: 'Convocatoria de partido actualizada exitosamente',
      data: updatedLineup,
    };
  }

  async remove(id: string) {
    const lineup = await this.prisma.matchLineup.findUnique({
      where: { id },
    });
    if (!lineup) {
      throw new NotFoundException(
        'La convocatoria solicitada no fue encontrada',
      );
    }

    const deletedLineup = await this.prisma.matchLineup.delete({
      where: { id },
      select: matchLineupSelect,
    });

    return {
      message: 'Convocatoria de partido eliminada exitosamente',
      data: deletedLineup,
    };
  }
}
