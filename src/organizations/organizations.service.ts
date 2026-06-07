import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { OrganizationsPaginationDto } from './dto/pagination.dto';
import { NotFoundError } from 'rxjs';

export const organizationSelect: Prisma.OrganizationSelect = {
  id: true,
  name: true,
  imageUrl: true,
  address: true,
  phone: true,
  email: true,
  clubs: {
    select: {
      id: true,
      name: true,
    },
  },
  schools: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger('OrganizationsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const newOrganization = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: createOrganizationDto,
        select: organizationSelect,
      });

      return organization;
    });

    return {
      message: 'Organización agregada exitosamente',
      data: newOrganization,
    };
  }

  async findAll(paginationDto: OrganizationsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.OrganizationWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [schools, totalItems] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: organizationSelect,
      }),
      this.prisma.organization.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: schools, // Será [] si la página no existe o no hay registros
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
      message: 'Organizaciones obtenidas exitosamente',
    };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: organizationSelect,
    });

    if (!organization) {
      throw new NotFoundException('Organizacion no encontrada');
    }
    return {
      message: 'Organizacion obtenida exitosamente',
      data: organization,
    };
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const updateOrganization = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id },
        data: updateOrganizationDto,
        select: organizationSelect,
      });

      return organization;
    });
    return {
      message: 'Organizacion editada exitosamente',
      data: updateOrganization,
    };
  }

  async remove(id: string) {
    const deleteOrganization = await this.prisma.organization.delete({
      where: { id },
      select: organizationSelect,
    });
    return {
      message: 'Organizacion eliminada exitosamente',
      data: deleteOrganization,
    };
  }
}
