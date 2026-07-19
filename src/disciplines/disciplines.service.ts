import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { PrismaService } from 'src/prisma.service';
import { DisciplinePaginationDto } from './dto/pagination.dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class DisciplinesService {
  private readonly logger = new Logger('DisciplinesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createDisciplineDto: CreateDisciplineDto) {
    try {
      const newDiscipline = await this.prisma.discipline.create({
        data: {
          ...createDisciplineDto,
        },
      });

      return {
        message: 'Disciplina agregada exitosamente',
        data: newDiscipline,
      };
    } catch (error) {
      // 1. Manejar errores conocidos de Prisma
      this.handleExceptions(error);
    }
  }

  async findAll(paginationDto: DisciplinePaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.DisciplineWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [disciplines, totalItems] = await Promise.all([
      this.prisma.discipline.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
      }),
      this.prisma.discipline.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: disciplines, // Será [] si la página no existe o no hay registros
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

  async findAllUnpaginated() {
    const disciplines = await this.prisma.discipline.findMany({
      orderBy: { name: 'asc' },
    });
    return {
      message: 'Disciplinas obtenidas exitosamente',
      data: disciplines,
    };
  }

  async findOne(id: string) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id },
    });
    if (!discipline) {
      throw new NotFoundException('errors.DISCIPLINE_NOT_FOUND');
    }
    return {
      message: 'Disciplina obtenida exitosamente',
      data: discipline,
    };
  }

  async update(id: string, updateDisciplineDto: UpdateDisciplineDto) {
    try {
      const updateDiscipline = await this.prisma.discipline.update({
        where: { id },
        data: updateDisciplineDto,
      });
      return {
        message: 'Disciplina editada exitosamente',
        data: updateDiscipline,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async remove(id: string) {
    try {
      const deleteDiscipline = await this.prisma.discipline.delete({
        where: { id },
      });
      return {
        message: 'Disciplina eliminada exitosamente',
        data: deleteDiscipline,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  private handleExceptions(error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        throw new NotFoundException('El recurso solicitado no fue encontrado');
      }
      const driverError = error.meta?.driverAdapterError as any;
      const fields = driverError.cause.constraint.fields;
      // console.log(fields); // [ 'title' ] o [ 'slug' ]
      // P2002 es el código para "Unique constraint failed"
      if (error.code === 'P2002') {
        throw new ConflictException({
          message: 'El producto ya existe',
          statusCode: 409,
          errors: {
            ...fields.reduce((acc, field) => {
              acc[field] = `El nombre ya existe`;
              return acc;
            }, {}),
          },
        });
      }

      // 2. Errores de Nest (como BadRequestException lanzados manualmente)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // 3. Fallo genérico (Error de conexión, etc.)
      this.logger.error(error);
      throw new InternalServerErrorException('Error interno del servidor');
    }
  }
}
