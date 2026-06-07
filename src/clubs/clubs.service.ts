import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { ClubsPaginationDto } from './dto/pagination.dto';

export const clubSelect: Prisma.ClubSelect = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
  discipline: {
    select: {
      id: true,
      name: true,
      icon: true,
    },
  },
};

@Injectable()
export class ClubsService {
  private readonly logger = new Logger('ClubsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createClubDto: CreateClubDto) {
    const organization = await this.prisma.organization.findFirst({
      select: {
        id: true,
      },
    });
    if (!organization) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    const newClub = await this.prisma.club.create({
      data: {
        ...createClubDto,
        organizationId: organization.id,
      },
      select: clubSelect,
    });

    return {
      message: 'Club agregado exitosamente',
      data: newClub,
    };
  }

  async findAll(paginationDto: ClubsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.ClubWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [clubs, totalItems] = await Promise.all([
      this.prisma.club.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: clubSelect,
      }),
      this.prisma.club.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: clubs, // Será [] si la página no existe o no hay registros
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
    const club = await this.prisma.club.findUnique({
      where: { id },
      select: clubSelect,
    });
    if (!club) {
      throw new NotFoundException('El club no fue encontrado');
    }
    return { data: club, message: 'Club obtenido exitosamente' };
  }

  async update(id: string, updateClubDto: UpdateClubDto) {
    const club = await this.findOne(id);
    if (!club) {
      throw new NotFoundException('El club no fue encontrado');
    }
    const organization = await this.prisma.organization.findFirst({
      select: {
        id: true,
      },
    });
    if (!organization) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    const updatedClub = await this.prisma.club.update({
      where: { id },
      data: {
        ...updateClubDto,
        organizationId: organization.id,
      },
      select: clubSelect,
    });

    return {
      message: 'Club actualizado exitosamente',
      data: updatedClub,
    };
  }

  async remove(id: string) {
    const club = await this.findOne(id);
    if (!club) {
      throw new NotFoundException('El club no fue encontrado');
    }

    await this.prisma.club.delete({
      where: { id },
    });

    return {
      message: 'Club eliminado exitosamente',
    };
  }

  async getClubsOptions() {
    const clubs = await this.prisma.club.findMany({
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
        icon: true,
      },
    });

    return {
      data: disciplines,
      message: 'Disciplinas obtenidas exitosamente',
    };
  }

  async getOrganizationsOptions() {
    const organizations = await this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: organizations,
      message: 'Organizaciones obtenidas exitosamente',
    };
  }
}
