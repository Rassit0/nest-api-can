import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { TeamsPaginationDto } from './dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

export const teamSelect: Prisma.TeamSelect = {
  id: true,
  name: true,
  shortName: true,
  description: true,
  imageUrl: true,
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(createTeamDto: CreateTeamDto, image?: Express.Multer.File) {
    const { imageUrl: _, ...rest } = createTeamDto;
    
    let imageUrl = null;
    if (image) {
      const uploadResult = await this.storageService.uploadFile(image, 'teams');
      imageUrl = uploadResult.url;
    }

    const newTeam = await this.prisma.team.create({
      data: {
        ...rest,
        ...(imageUrl && { imageUrl }),
      },
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

  async update(id: string, updateTeamDto: UpdateTeamDto, image?: Express.Multer.File) {
    const { imageUrl: _, ...rest } = updateTeamDto;
    const team = await this.findOne(id);
    if (!team) {
      throw new NotFoundException('El equipo no fue encontrado');
    }
    
    let newImageUrl = undefined;
    if (image) {
      const uploadResult = await this.storageService.uploadFile(image, 'teams');
      newImageUrl = uploadResult.url;
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: {
        ...rest,
        ...(newImageUrl !== undefined && { imageUrl: newImageUrl }),
      },
      select: teamSelect,
    });
    
    // Cleanup old image if it was replaced
    if (newImageUrl && team.data.imageUrl) {
      try {
        const internalName = this.storageService.extractInternalNameFromUrl(team.data.imageUrl);
        if (internalName) {
          await this.storageService.deleteFile(internalName);
        }
      } catch (e) {
        this.logger.error(`Error al eliminar imagen anterior de equipo ${id}`, e);
      }
    }

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

  async getTeamsOptions() {
    const teams = await this.prisma.team.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        imageUrl: true,
        club: {
          select: {
            id: true,
            name: true,
            isExternal: true,
            discipline: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: teams,
      message: 'Equipos obtenidos exitosamente',
    };
  }

  async getClubContext(clubId: string) {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: {
        id: true,
        name: true,
        discipline: {
          select: {
            name: true,
            icon: true,
          },
        },
      },
    });

    if (!club) {
      throw new NotFoundException('El club no fue encontrado');
    }

    return {
      data: club,
      message: 'Club obtenido exitosamente',
    };
  }
}
