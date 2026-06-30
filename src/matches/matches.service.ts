import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { MatchesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const matchSelect: Prisma.MatchSelect = {
  id: true,
  opponentName: true,
  matchDate: true,
  type: true,
  ourScore: true,
  theirScore: true,
  result: true,
  createdAt: true,
  updatedAt: true,
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
  location: {
    select: {
      id: true,
      name: true,
      address: true,
    },
  },
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger('MatchesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createMatchDto: CreateMatchDto) {
    const newMatch = await this.prisma.match.create({
      data: createMatchDto,
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
      sortField = 'matchDate',
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
          location: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [matches, totalItems] = await Promise.all([
      this.prisma.match.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
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
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    const updatedMatch = await this.prisma.match.update({
      where: { id },
      data: updateMatchDto,
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
