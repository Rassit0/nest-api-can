import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamSeasonDto } from './dto/create-team-season.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-season.dto';
import { PrismaService } from 'src/prisma.service';
import {
  PlayerMembershipStatus,
  Prisma,
  SeasonStatus,
} from 'src/generated/prisma/client';
import { TeamCategorySeasonsPaginationDto } from './dto/pagination.dto';

export const teamCategorySelect: Prisma.TeamSeasonSelect = {
  id: true,
  gender: true,
  team: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      minAge: true,
      maxAge: true,
    },
  },
  season: {
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
    },
  },
  description: true,
  maxMembers: true,
  minMembers: true,
  billingDay: true,
  registrationFee: true,
  monthlyFee: true,
  debtToleranceMonths: true,
  lateFeeEnabled: true,
  lateFeePerDay: true,
  graceDays: true,
  status: true,
  _count: {
    select: {
      playerMemberships: {
        where: {
          OR: [
            {
              status: PlayerMembershipStatus.SUSPENDED,
            },
            {
              status: PlayerMembershipStatus.ACTIVE,
            },
          ],
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class TeamSeasonService {
  private readonly logger = new Logger('TeamCategoriesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamCategoryDto: CreateTeamSeasonDto) {
    const { imageUrl, ...rest } = createTeamCategoryDto;

    const season = await this.prisma.season.findUnique({
      where: { id: createTeamCategoryDto.seasonId },
    });

    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    const category = await this.prisma.category.findUnique({
      where: { id: createTeamCategoryDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }

    if (season.disciplineId !== category.disciplineId) {
      throw new NotFoundException(
        'La temporada y la categoria no pertenecen a la misma disciplina',
      );
    }

    const newTeamCategorySeason = await this.prisma.teamSeason.create({
      data: {
        ...rest,
      },
      select: teamCategorySelect,
    });

    return {
      message: 'Temporada asignada a equipo exitosamente',
      data: newTeamCategorySeason,
    };
  }

  async findAll(paginationDto: TeamCategorySeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      gender,
      teamId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.TeamSeasonWhereInput = search
      ? {
          OR: [
            { team: { name: { contains: search, mode: 'insensitive' } } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    if (teamId) {
      where.teamId = teamId;
    }

    if (gender) {
      where.gender = gender;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [teamCategorieSeasons, totalItems] = await Promise.all([
      this.prisma.teamSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: teamCategorySelect,
      }),
      this.prisma.teamSeason.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Temporadas de equipo obtenidas exitosamente',
      data: teamCategorieSeasons, // Será [] si la página no existe o no hay registros
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
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: teamCategorySelect,
    });
    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }
    return {
      data: teamSeason,
      message: 'Temporada de equipo obtenida exitosamente',
    };
  }

  async update(id: string, updateTeamSeasonDto: UpdateTeamSeasonDto) {
    const { teamId, categoryId, seasonId, imageUrl, ...rest } =
      updateTeamSeasonDto;
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: teamCategorySelect,
    });
    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }

    let season = await this.prisma.season.findUnique({
      where: { id: seasonId ? seasonId : teamSeason.seasonId },
    });

    let category = await this.prisma.category.findUnique({
      where: { id: categoryId ? categoryId : teamSeason.categoryId },
    });

    if (updateTeamSeasonDto.seasonId) {
      season = await this.prisma.season.findUnique({
        where: { id: updateTeamSeasonDto.seasonId },
      });
    }

    if (updateTeamSeasonDto.categoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: updateTeamSeasonDto.categoryId },
      });
    }

    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }
    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }

    if (season.disciplineId !== category.disciplineId) {
      throw new NotFoundException(
        'La temporada y la categoria no pertenecen a la misma disciplina',
      );
    }

    const updatedTeamCategory = await this.prisma.teamSeason.update({
      where: { id },
      data: {
        ...rest,
      },
      select: teamCategorySelect,
    });
    return {
      message: 'Temporada de equipo actualizada exitosamente',
      data: updatedTeamCategory,
    };
  }

  async getSeasonsOptions() {
    const seasons = await this.prisma.season.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: seasons,
      message: 'Temporadas obtenidas exitosamente',
    };
  }

  async getCategoriesByDisciplineOptions(disciplineId: string) {
    const categories = await this.prisma.category.findMany({
      where: { disciplineId },
      select: {
        id: true,
        name: true,
        minAge: true,
        maxAge: true,
      },
    });

    return {
      data: categories,
      message: 'Categorias obtenidas exitosamente',
    };
  }
  async getSeasonsByDisciplineOptions(disciplineId: string) {
    const seasons = await this.prisma.season.findMany({
      where: { disciplineId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    return {
      data: seasons,
      message: 'Temporadas obtenidas exitosamente',
    };
  }

  async remove(id: string) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        playerMemberships: true,
      },
    });
    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }
    if (teamSeason.status !== SeasonStatus.DRAFT) {
      throw new BadRequestException(
        'La temporada de equipo no puede ser eliminada',
      );
    }
    if (teamSeason.playerMemberships?.length > 0) {
      throw new BadRequestException(
        'La temporada no puede ser eliminada porque tiene registros asociados',
      );
    }
    await this.prisma.teamSeason.delete({
      where: { id },
    });
    return {
      message: 'Temporada de equipo eliminada exitosamente',
      data: teamSeason,
    };
  }

  // async finalize(id: string, finalizeTeamSeasonDto: FinalizeTeamSeasonDto) {
  //   const teamSeason = await this.findOne(id);
  //   if (teamSeason.data.status === SeasonStatus.ACTIVE) {
  //     const updatedTeamOffering = await this.prisma.teamSeason.update({
  //       where: { id },
  //       data: {
  //         status: SeasonStatus.FINISHED,
  //         statusNotes: finalizeTeamSeasonDto.statusNotes,
  //       },
  //       select: teamSeasonSelect,
  //     });
  //     return {
  //       message: 'Temporada de equipo finalizada exitosamente',
  //       data: updatedTeamOffering,
  //     };
  //   } else {
  //     throw new BadRequestException(
  //       'La temporada de equipo no puede ser finalizada',
  //     );
  //   }
  // }

  // async cancel(id: string, cancelTeamSeasonDto: CancelTeamSeasonDto) {
  //   const teamSeason = await this.findOne(id);
  //   if (teamSeason.data.status === SeasonStatus.ACTIVE) {
  //     const updatedTeamOffering = await this.prisma.teamSeason.update({
  //       where: { id },
  //       data: {
  //         status: SeasonStatus.CANCELLED,
  //         statusNotes: cancelTeamSeasonDto.statusNotes,
  //       },
  //       select: teamSeasonSelect,
  //     });
  //     return {
  //       message: 'Temporada de equipo cancelada exitosamente',
  //       data: updatedTeamOffering,
  //     };
  //   } else {
  //     throw new BadRequestException(
  //       'La temporada de equipo no puede ser cancelada',
  //     );
  //   }
  // }

  // async extend(id: string, extendTeamSeasonDto: ExtendTeamSeasonDto) {
  //   const teamSeason = await this.findOne(id);
  //   if (teamSeason.data.status === SeasonStatus.ACTIVE) {
  //     if (teamSeason.data.endDate > new Date(extendTeamSeasonDto.newEndDate)) {
  //       throw new BadRequestException(
  //         'La nueva fecha final no puede ser menor a la fecha final de la temporada',
  //       );
  //     }
  //     return await this.prisma.$transaction(async (tx) => {
  //       const updatedTeamSeason = await tx.teamSeason.update({
  //         where: { id },
  //         data: {
  //           endDate: extendTeamSeasonDto.newEndDate,
  //           statusNotes: extendTeamSeasonDto.reason,
  //         },
  //         select: teamSeasonSelect,
  //       });

  //       // Crear el registro de extensión historico
  //       await tx.teamSeasonExtension.create({
  //         data: {
  //           teamSeasonId: id,
  //           previousEndDate: teamSeason.data.endDate,
  //           newEndDate: extendTeamSeasonDto.newEndDate,
  //           reason: extendTeamSeasonDto.reason,
  //         },
  //       });
  //       return {
  //         message: 'Temporada de equipo extendida exitosamente',
  //         data: updatedTeamSeason,
  //       };
  //     });
  //   } else {
  //     throw new BadRequestException(
  //       'La temporada de equipo no puede ser extendida',
  //     );
  //   }
  // }
}
