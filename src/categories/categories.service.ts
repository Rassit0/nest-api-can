import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'src/prisma.service';
import { CategoriesPaginationDto } from './dto/pagination.dto';
import { Prisma } from 'src/generated/prisma/client';
import slugify from 'slugify';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger('CategoriesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    try {
      const slug = slugify(createCategoryDto.name, { lower: true });
      const newCategory = await this.prisma.category.create({
        data: { ...createCategoryDto, slug },
      });

      return {
        message: 'Categoría agregada exitosamente',
        data: newCategory,
      };
    } catch (error) {
      // 1. Manejar errores conocidos de Prisma
      this.handleExceptions(error);
    }
  }

  async findAll(paginationDto: CategoriesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'name',
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.CategoryWhereInput = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [categories, totalItems] = await Promise.all([
      this.prisma.category.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
      }),
      this.prisma.category.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      data: categories, // Será [] si la página no existe o no hay registros
      meta: {
        totalItems, // Ej: 25
        itemsPerPage: per_page, // Ej: 10
        totalPages, // Ej: 3
        currentPage, // Ej: 10 (si el usuario pidió el page 90)
        // ¡Estos 2 valores ahorran mucho trabajo en el front!
        hasNextPage: page < Math.ceil(totalItems / per_page),
        hasPrevPage: page > 1,
      },
      message: 'Categorías obtenidas exitosamente',
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} discipline`;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    try {
      const slug = updateCategoryDto.name
        ? slugify(updateCategoryDto.name, { lower: true })
        : undefined;
      const updateCategory = await this.prisma.category.update({
        where: { id },
        data: { ...updateCategoryDto, slug },
      });
      return {
        message: 'Categoría editada exitosamente',
        data: updateCategory,
      };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async remove(id: number) {
    try {
      const deleteCategory = await this.prisma.category.delete({
        where: { id },
      });
      return {
        message: 'Categoría eliminada exitosamente',
        data: deleteCategory,
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
          message: this.i18n.t('validation.ALREADY_EXISTS', {
            args: {
              entity: this.i18n.t(`fields.category`),
            },
          }),
          statusCode: 409,
          errors: {
            ...fields.reduce((acc, field) => {
              acc['name'] = this.i18n.t('validation.ALREADY_EXISTS', {
                args: {
                  entity: this.i18n.t(`fields.category`),
                },
              });
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
