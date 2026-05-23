import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import {
  ActivitiesPaginationDto,
  CategoriesPaginationDto,
  DisciplinesPaginationDto,
} from './dto/pagination.dto';
import { ActivitiesSummaryPaginationDto } from './dto/pagination-summary.dto';

export const activitySelect: Prisma.ActivitySelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
    },
  },
};

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger('ActivitiesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createActivityDto: CreateActivityDto) {
    const { startsAt, endsAt, ...activityData } = createActivityDto;

    // ✅ Convertir strings a Date
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    // Validación básica de coherencia
    if (start >= end) {
      throw new BadRequestException({
        message: 'La fecha de inicio debe ser menor o igual a la de fin',
        statusCode: 400,
        errors: {
          startDate: 'La fecha de inicio debe ser menor o igual a la de fin',
          endDate: 'La fecha de fin debe ser mayor o igual a la de inicio',
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Crear la actividad con los objetos Date
      const activity = await tx.activity.create({
        data: {
          ...activityData,
          startsAt: start,
          endsAt: end,
        },
      });

      this.logger.log('Actividad creada exitosamente', activity);
      return activity;
    });
  }

  async findAll(paginationDto: ActivitiesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
      type,
      // organizationId,
      teamOfferingId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    // Construcción dinámica del objeto 'where'
    const where: Prisma.ActivityWhereInput = {};

    // Filtro por búsqueda de texto
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    // Filtro por tipo (asumiendo que 'type' es un campo en tu modelo Activity)
    if (type) {
      where.type = type; // O { equals: type }
    }

    // if (organizationId) {
    //   where.organizationActivities = { some: { organizationId } };
    // }

    if (teamOfferingId) {
      where.teamOfferingActivities = { some: { teamOfferingId } };
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [activities, totalItems] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: activitySelect,
      }),
      this.prisma.activity.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: activities, // Será [] si la página no existe o no hay registros
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
      message: 'Actividades obtenidas exitosamente',
    };
  }

  async findOne(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      select: activitySelect,
    });
    if (!activity) {
      throw new NotFoundException('La actividad no fue encontrada');
    }
    return activity;
  }

  async update(id: string, updateActivityDto: UpdateActivityDto) {
    const { startsAt, endsAt, ...activityData } = updateActivityDto;

    const activity = await this.findOne(id);

    // ✅ Convertir strings a Date
    const start = new Date(startsAt || activity.startsAt);
    const end = new Date(endsAt || activity.endsAt);

    // Validación básica de coherencia
    if (start > end) {
      throw new BadRequestException({
        message: 'La fecha de inicio debe ser anterior a la de fin',
        statusCode: 400,
        errors: {
          startDate: 'La fecha de inicio debe ser anterior a la de fin',
          endDate: 'La fecha de fin debe ser posterior a la de inicio',
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Actualizar datos básicos de la actividad
      const updatedActivity = await tx.activity.update({
        where: { id },
        data: {
          ...activityData,
          startsAt: start,
          endsAt: end,
        },
      });

      this.logger.log('Actividad actualizada exitosamente', updatedActivity);
      return updatedActivity;
    });
  }

  remove(id: string) {
    return `This action removes a #${id} activity`;
  }

  async getLocationsOptions() {
    const locations = await this.prisma.location.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: locations,
      message: 'Ubicaciones obtenidas exitosamente',
    };
  }

  // obtener resumen de actividades
  async getSummary(paginationDto: ActivitiesSummaryPaginationDto) {
    const { teamOfferingId } = paginationDto;

    // Construcción dinámica del objeto 'where'
    const where: Prisma.ActivityWhereInput = {};

    if (teamOfferingId) {
      where.teamOfferingActivities = { some: { teamOfferingId } };
    }

    const [
      totalActivities,
      publishedActivities,
      finishedActivities,
      cancelledActivities,
    ] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.count({ where: { ...where } }),
      this.prisma.activity.count({ where: { ...where } }),
      this.prisma.activity.count({ where: { ...where } }),
    ]);

    return {
      totalActivities,
      publishedActivities,
      finishedActivities,
      cancelledActivities,
    };
  }
}
