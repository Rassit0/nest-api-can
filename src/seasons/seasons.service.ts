import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { SeasonsPaginationDto } from './dto/pagination.dto';
import { ExtendSeasonDto } from './dto/extend.dto';
import { FinalizeSeasonDto } from './dto/finalize.dto';
import { CancelSeasonDto } from './dto/cancel.dto';

export const seasonSelect: Prisma.SeasonSelect = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  events: {
    orderBy: { createdAt: 'desc' },
  },
  discipline: {
    select: {
      id: true,
      name: true,
      icon: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class SeasonsService {
  private readonly logger = new Logger('SeasonsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createSeasonDto: CreateSeasonDto) {
    const newSeason = await this.prisma.season.create({
      data: createSeasonDto,
      select: seasonSelect,
    });

    return {
      message: 'Temporada agregada exitosamente',
      data: newSeason,
    };
  }

  async findAll(paginationDto: SeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      teamId,
      seasonId,
      disciplineId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.SeasonWhereInput = search
      ? {
          OR: [{ name: { contains: search, mode: 'insensitive' } }],
        }
      : {};

    if (teamId) {
      where.teamSeasons = { some: { teamId } };
    }

    if (seasonId) {
      where.teamSeasons = { some: { seasonId } };
    }

    if (disciplineId) {
      where.disciplineId = disciplineId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [seasons, totalItems] = await Promise.all([
      this.prisma.season.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: seasonSelect,
      }),
      this.prisma.season.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Temporadas obtenidas exitosamente',
      data: seasons, // Será [] si la página no existe o no hay registros
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
    const season = await this.prisma.season.findUnique({
      where: { id },
      select: seasonSelect,
    });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }
    return {
      data: season,
      message: 'Temporada obtenida exitosamente',
    };
  }

  async update(id: string, updateSeasonDto: UpdateSeasonDto) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      select: seasonSelect,
    });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }
    const updatedSeason = await this.prisma.season.update({
      where: { id },
      data: updateSeasonDto,
      select: seasonSelect,
    });
    return {
      message: 'Temporada actualizada exitosamente',
      data: updatedSeason,
    };
  }

  async remove(id: string) {
    const season = await this.prisma.season.findUnique({
      where: { id },
      select: seasonSelect,
    });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }
    const deletedSeason = await this.prisma.season.delete({
      where: { id },
      select: seasonSelect,
    });
    return {
      message: 'Temporada eliminada exitosamente',
      data: deletedSeason,
    };
  }

  async extend(id: string, extendSeasonDto: ExtendSeasonDto) {
    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    const updatedSeason = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.season.update({
        where: { id },
        data: {
          endDate: new Date(extendSeasonDto.newEndDate),
        },
        select: seasonSelect,
      });

      await tx.seasonEvent.create({
        data: {
          seasonId: id,
          eventType: 'EXTENSION',
          originalEndDate: season.endDate,
          newEndDate: new Date(extendSeasonDto.newEndDate),
          reason: extendSeasonDto.reason,
        },
      });

      return updated;
    });

    return {
      message: 'Temporada extendida exitosamente',
      data: updatedSeason,
    };
  }

  async finish(id: string, finalizeSeasonDto: FinalizeSeasonDto) {
    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    const updatedSeason = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.season.update({
        where: { id },
        data: {
          status: 'FINISHED',
        },
        select: seasonSelect,
      });

      await tx.seasonEvent.create({
        data: {
          seasonId: id,
          eventType: 'FINALIZATION',
          reason: finalizeSeasonDto.reason,
        },
      });

      return updated;
    });

    return {
      message: 'Temporada finalizada exitosamente',
      data: updatedSeason,
    };
  }

  async cancel(id: string, cancelSeasonDto: CancelSeasonDto) {
    const season = await this.prisma.season.findUnique({ where: { id } });
    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    const updatedSeason = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.season.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
        select: seasonSelect,
      });

      await tx.seasonEvent.create({
        data: {
          seasonId: id,
          eventType: 'CANCELLATION',
          reason: cancelSeasonDto.reason,
        },
      });

      return updated;
    });

    return {
      message: 'Temporada cancelada exitosamente',
      data: updatedSeason,
    };
  }

  async autoFinalizeExpiredSeasons() {
    this.logger.log('Iniciando proceso de finalización automática de temporadas...');
    const now = new Date();

    const expiredSeasons = await this.prisma.season.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: now },
      },
    });

    if (expiredSeasons.length === 0) {
      this.logger.log('No hay temporadas expiradas para finalizar.');
      return { message: 'No hay temporadas expiradas para finalizar.' };
    }

    let count = 0;
    for (const season of expiredSeasons) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.season.update({
            where: { id: season.id },
            data: { status: 'FINISHED' },
          });

          await tx.seasonEvent.create({
            data: {
              seasonId: season.id,
              eventType: 'FINALIZATION',
              reason: 'Finalización automática por el sistema al cumplirse la fecha de cierre.',
            },
          });
        });
        count++;
      } catch (error) {
        this.logger.error(
          `Error al auto-finalizar la temporada ${season.id}:`,
          error,
        );
      }
    }

    this.logger.log(`Proceso terminado. Se finalizaron ${count} temporadas.`);
    return { message: `Se finalizaron ${count} temporadas automáticamente.` };
  }
}
