import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { TeamsPaginationDto } from './dto/pagination.dto';

export const teamSelect: Prisma.TeamSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  club: {
    select: {
      id: true,
      name: true,
      discipline: {
        select: {
          id: true,
          name: true,
          icon: true,
        },
      },
    },
  },
};

@Injectable()
export class TeamsService {
  private readonly logger = new Logger('ClubsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto) {
    const { imageUrl, ...rest } = createTeamDto;
    const newTeam = await this.prisma.team.create({
      data: rest,
      select: teamSelect,
    });

    return {
      message: 'Equipo agregado exitosamente',
      data: newTeam,
    };
  }

  async findAll(paginationDto: TeamsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      clubId,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.TeamWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    if (clubId) {
      where.clubId = clubId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [teams, totalItems] = await Promise.all([
      this.prisma.team.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: teamSelect,
      }),
      this.prisma.team.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: teams, // Será [] si la página no existe o no hay registros
      meta: {
        totalItems, // Ej: 25
        itemsPerPage: per_page, // Ej: 10
        totalPages, // Ej: 3
        currentPage, // Ej: 10 (si el usuario pidió el page 90)
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      select: teamSelect,
    });
    if (!team) {
      throw new NotFoundException('El equipo no fue encontrado');
    }
    return { data: team, message: 'Equipo obtenido exitosamente' };
  }

  async update(id: string, updateTeamDto: UpdateTeamDto) {
    const { imageUrl, ...rest } = updateTeamDto;
    const team = await this.findOne(id);
    if (!team) {
      throw new NotFoundException('El equipo no fue encontrado');
    }
    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: {
        ...rest,
      },
      select: teamSelect,
    });

    return {
      message: 'Equipo actualizado exitosamente',
      data: updatedTeam,
    };
  }

  async remove(id: string) {
    const team = await this.findOne(id);
    if (!team) {
      throw new NotFoundException('El equipo no fue encontrado');
    }

    await this.prisma.team.delete({
      where: { id },
    });

    return {
      message: 'Equipo eliminado exitosamente',
    };
  }

  async getClubsByDisciplineOptions(disciplineId: string) {
    const clubs = await this.prisma.club.findMany({
      where: { disciplineId },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: clubs,
      message: 'Clubs obtenidos exitosamente',
    };
  }

  async getDisciplinesOptions() {
    const disciplines = await this.prisma.discipline.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: disciplines,
      message: 'Disciplinas obtenidas exitosamente',
    };
  }
}
