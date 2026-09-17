import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { ClubsPaginationDto } from './dto/pagination.dto';
import { StorageService } from '../storage/storage.service';

export const clubSelect: Prisma.ClubSelect = {
  id: true,
  name: true,
  shortName: true,
  imageUrl: true,
  isExternal: true,
  createdAt: true,
  updatedAt: true,
  institution: {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async create(createClubDto: CreateClubDto, image?: Express.Multer.File) {
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }
    
    let imageUrl = null;
    if (image) {
      const uploadResult = await this.storageService.uploadFile(image, 'clubs');
      imageUrl = uploadResult.url;
    }

    const newClub = await this.prisma.club.create({
      data: {
        ...createClubDto,
        institutionId: institution.id,
        ...(imageUrl && { imageUrl }),
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
      disciplineId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.ClubWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    if (disciplineId) {
      where.disciplineId = disciplineId;
    }

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

  async update(id: string, updateClubDto: UpdateClubDto, image?: Express.Multer.File) {
    const club = await this.prisma.club.findUnique({
      where: { id },
    });
    if (!club) {
      throw new NotFoundException('El club no fue encontrado');
    }
    const institution = await this.prisma.institution.findFirst({
      select: {
        id: true,
      },
    });
    if (!institution) {
      throw new NotFoundException('La organización no fue encontrada');
    }

    const hasRelations = await this.prisma.teamSeason.findFirst({
      where: {
        team: {
          clubId: id,
        },
      },
      select: {
        id: true,
      },
    });

    if (
      updateClubDto.disciplineId &&
      updateClubDto.disciplineId !== club.disciplineId &&
      hasRelations
    ) {
      throw new BadRequestException(
        'No se puede cambiar la disciplina porque el club tiene equipos y categorías relacionadas.',
      );
    }
    
    let newImageUrl = undefined;
    if (image) {
      const uploadResult = await this.storageService.uploadFile(image, 'clubs');
      newImageUrl = uploadResult.url;
    }

    const updatedClub = await this.prisma.club.update({
      where: { id },
      data: {
        ...updateClubDto,
        institutionId: institution.id,
        ...(newImageUrl !== undefined && { imageUrl: newImageUrl }),
      },
      select: clubSelect,
    });
    
    // Cleanup old image if it was replaced
    if (newImageUrl && club.imageUrl) {
      try {
        const internalName = this.storageService.extractInternalNameFromUrl(club.imageUrl);
        if (internalName) {
          await this.storageService.deleteFile(internalName);
        }
      } catch (e) {
        this.logger.error(`Error al eliminar imagen anterior de club ${id}`, e);
      }
    }

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
        imageUrl: true,
        isExternal: true,
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
    const institutions = await this.prisma.institution.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: institutions,
      message: 'Organizaciones obtenidas exitosamente',
    };
  }
}
