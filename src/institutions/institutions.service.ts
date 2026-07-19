import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { InstitutionsPaginationDto } from './dto/pagination.dto';
import { NotFoundError } from 'rxjs';

export const institutionsSelect: Prisma.InstitutionSelect = {
  id: true,
  name: true,
  imageUrl: true,
  address: true,
  latitude: true,
  longitude: true,
  googleMapsUrl: true,
  contacts: {
    select: {
      id: true,
      department: true,
      contactName: true,
      phone: true,
      email: true,
      isDefault: true,
    },
  },
  clubs: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger('InstitutionsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createInstitutionDto: CreateInstitutionDto) {
    const newInstitution = await this.prisma.$transaction(async (tx) => {
      const institutions = await tx.institution.create({
        data: createInstitutionDto,
        select: institutionsSelect,
      });

      return institutions;
    });

    return {
      message: 'Organización agregada exitosamente',
      data: newInstitution,
    };
  }

  async findAll(paginationDto: InstitutionsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.InstitutionWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [schools, totalItems] = await Promise.all([
      this.prisma.institution.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: institutionsSelect,
      }),
      this.prisma.institution.count({ where }),
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
    const institutions = await this.prisma.institution.findUnique({
      where: { id },
      select: institutionsSelect,
    });

    if (!institutions) {
      throw new NotFoundException('Organizacion no encontrada');
    }
    return {
      message: 'Organizacion obtenida exitosamente',
      data: institutions,
    };
  }

  async findDefault() {
    const institution = await this.prisma.institution.findFirst({
      select: institutionsSelect,
    });

    if (!institution) {
      throw new NotFoundException('No hay ninguna institución registrada');
    }
    
    return {
      message: 'Institución principal obtenida exitosamente',
      data: institution,
    };
  }

  async update(id: string, updateInstitutionDto: UpdateInstitutionDto) {
    const updateInstitution = await this.prisma.$transaction(async (tx) => {
      const institutions = await tx.institution.update({
        where: { id },
        data: updateInstitutionDto,
        select: institutionsSelect,
      });

      return institutions;
    });
    return {
      message: 'Organizacion editada exitosamente',
      data: updateInstitution,
    };
  }

  async remove(id: string) {
    const deleteInstitution = await this.prisma.institution.delete({
      where: { id },
      select: institutionsSelect,
    });
    return {
      message: 'Organizacion eliminada exitosamente',
      data: deleteInstitution,
    };
  }
}
