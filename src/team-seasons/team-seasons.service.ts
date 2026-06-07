import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamSeasonsDto } from './dto/create-team-seasons.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-seasons.dto';
import { Prisma, SeasonStatus } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { TeamSeasonsPaginationDto } from './dto/pagination.dto';
import { FinalizeTeamSeasonDto } from './dto/finalize.dto';
import { CancelTeamSeasonDto } from './dto/cancel.dto';
import { ExtendTeamSeasonDto } from './dto/extend.dto';

export const teamSeasonSelect: Prisma.TeamSeasonSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  teamId: true,
  maxMembers: true,
  minMembers: true,
  maxYear: true,
  minYear: true,
  monthlyFee: true,
  registrationFee: true,
  fullPaymentDiscountPercent: true,
  lateFeeEnabled: true,
  lateFeePerDay: true,
  graceDays: true,
  suspensionAfterMonthsDue: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  team: {
    select: {
      id: true,
      name: true,
      club: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

@Injectable()
export class TeamSeasonsService {
  private readonly logger = new Logger('ClubsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamOfferingDto: CreateTeamSeasonsDto) {
    const newTeamOffering = await this.prisma.teamSeason.create({
      data: {
        ...createTeamOfferingDto,
      },
      select: teamSeasonSelect,
    });

    return {
      message: 'Temporada de equipo agregada exitosamente',
      data: newTeamOffering,
    };
  }

  async findAll(paginationDto: TeamSeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      status,
      teamId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.TeamSeasonWhereInput = search
      ? {
          OR: [
            { team: { name: { contains: search, mode: 'insensitive' } } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    if (teamId) {
      where.teamId = teamId;
    }

    if (status) {
      where.status = status;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [teamSeasons, totalItems] = await Promise.all([
      this.prisma.teamSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: teamSeasonSelect,
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
      data: teamSeasons, // Será [] si la página no existe o no hay registros
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
      select: teamSeasonSelect,
    });
    if (!teamSeason) {
      throw new NotFoundException('La temporada de equipo no fue encontrada');
    }
    return {
      data: teamSeason,
      message: 'Temporada de equipo obtenida exitosamente',
    };
  }

  async update(id: string, updateTeamOfferingDto: UpdateTeamSeasonDto) {
    await this.findOne(id);
    const updatedTeamOffering = await this.prisma.teamSeason.update({
      where: { id },
      data: {
        ...updateTeamOfferingDto,
      },
      select: teamSeasonSelect,
    });

    return {
      message: 'Temporada de equipo actualizada exitosamente',
      data: updatedTeamOffering,
    };
  }

  async remove(id: string) {
    const teamSeason = await this.findOne(id);
    if (teamSeason.data.status !== SeasonStatus.DRAFT) {
      throw new BadRequestException(
        'La temporada de equipo no puede ser eliminada',
      );
    }
    if (
      teamSeason.data.teamMemberships?.length > 0 ||
      teamSeason.data.teamSeasonActivities?.length > 0 ||
      teamSeason.data.teamSeasonExtensions?.length > 0
    ) {
      throw new BadRequestException(
        'La temporada no puede ser eliminada porque tiene registros asociados',
      );
    }
    await this.prisma.teamSeason.delete({
      where: { id },
    });
    return {
      message: 'Temporada de equipo eliminada exitosamente',
      data: teamSeason.data,
    };
  }

  async finalize(id: string, finalizeTeamSeasonDto: FinalizeTeamSeasonDto) {
    const teamSeason = await this.findOne(id);
    if (teamSeason.data.status === SeasonStatus.ACTIVE) {
      const updatedTeamOffering = await this.prisma.teamSeason.update({
        where: { id },
        data: {
          status: SeasonStatus.FINISHED,
          statusNotes: finalizeTeamSeasonDto.statusNotes,
        },
        select: teamSeasonSelect,
      });
      return {
        message: 'Temporada de equipo finalizada exitosamente',
        data: updatedTeamOffering,
      };
    } else {
      throw new BadRequestException(
        'La temporada de equipo no puede ser finalizada',
      );
    }
  }

  async cancel(id: string, cancelTeamSeasonDto: CancelTeamSeasonDto) {
    const teamSeason = await this.findOne(id);
    if (teamSeason.data.status === SeasonStatus.ACTIVE) {
      const updatedTeamOffering = await this.prisma.teamSeason.update({
        where: { id },
        data: {
          status: SeasonStatus.CANCELLED,
          statusNotes: cancelTeamSeasonDto.statusNotes,
        },
        select: teamSeasonSelect,
      });
      return {
        message: 'Temporada de equipo cancelada exitosamente',
        data: updatedTeamOffering,
      };
    } else {
      throw new BadRequestException(
        'La temporada de equipo no puede ser cancelada',
      );
    }
  }

  async extend(id: string, extendTeamSeasonDto: ExtendTeamSeasonDto) {
    const teamSeason = await this.findOne(id);
    if (teamSeason.data.status === SeasonStatus.ACTIVE) {
      if (teamSeason.data.endDate > new Date(extendTeamSeasonDto.newEndDate)) {
        throw new BadRequestException(
          'La nueva fecha final no puede ser menor a la fecha final de la temporada',
        );
      }
      return await this.prisma.$transaction(async (tx) => {
        const updatedTeamSeason = await tx.teamSeason.update({
          where: { id },
          data: {
            endDate: extendTeamSeasonDto.newEndDate,
            statusNotes: extendTeamSeasonDto.reason,
          },
          select: teamSeasonSelect,
        });

        // Crear el registro de extensión historico
        await tx.teamSeasonExtension.create({
          data: {
            teamSeasonId: id,
            previousEndDate: teamSeason.data.endDate,
            newEndDate: extendTeamSeasonDto.newEndDate,
            reason: extendTeamSeasonDto.reason,
          },
        });
        return {
          message: 'Temporada de equipo extendida exitosamente',
          data: updatedTeamSeason,
        };
      });
    } else {
      throw new BadRequestException(
        'La temporada de equipo no puede ser extendida',
      );
    }
  }
}
