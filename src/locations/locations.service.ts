import { Injectable, Logger } from '@nestjs/common';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PrismaService } from 'src/prisma.service';
import { LocationsPaginationDto } from './dto/pagination.dto';
import { Prisma } from 'src/generated/prisma/client';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger('LocationsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createLocationDto: CreateLocationDto) {
    const newLocation = await this.prisma.location.create({
      data: createLocationDto,
    });

    return {
      message: 'Lugar agregado exitosamente',
      data: newLocation,
    };
  }

  async findAll(paginationDto: LocationsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.LocationWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [locations, totalItems] = await Promise.all([
      this.prisma.location.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
      }),
      this.prisma.location.count({ where }),
    ]);

    return createPaginationResult(
      locations,
      totalItems,
      page,
      per_page,
      'Lugares obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
    });
    return {
      message: 'Lugar obtenido exitosamente',
      data: location,
    };
  }

  async update(id: string, updateLocationDto: UpdateLocationDto) {
    const updateLocation = await this.prisma.location.update({
      where: { id },
      data: updateLocationDto,
    });
    return {
      message: 'Lugar editado exitosamente',
      data: updateLocation,
    };
  }

  async remove(id: string) {
    const deleteLocation = await this.prisma.location.delete({
      where: { id },
    });
    return {
      message: 'Lugar eliminado exitosamente',
      data: deleteLocation,
    };
  }
}
