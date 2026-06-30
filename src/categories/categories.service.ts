import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CategoriesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const categorySelect: Prisma.CategorySelect = {
  id: true,
  name: true,
  description: true,
  maxAge: true,
  minAge: true,
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
export class CategoriesService {
  private readonly logger = new Logger('CategoriesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const newCategory = await this.prisma.category.create({
      data: {
        ...createCategoryDto,
      },
      select: categorySelect,
    });

    return {
      message: 'Categoria agregada exitosamente',
      data: newCategory,
    };
  }

  async findAll(paginationDto: CategoriesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      teamId,
      disciplineId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.CategoryWhereInput = search
      ? {
          OR: [{ name: { contains: search, mode: 'insensitive' } }],
        }
      : {};

    if (teamId) {
      where.teamSeasons = { some: { teamId } };
    }

    if (disciplineId) {
      where.disciplineId = disciplineId;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [categories, totalItems] = await Promise.all([
      this.prisma.category.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: categorySelect,
      }),
      this.prisma.category.count({ where }),
    ]);

    return createPaginationResult(
      categories,
      totalItems,
      page,
      per_page,
      'Categorias obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }
    return {
      data: category,
      message: 'Categoria obtenida exitosamente',
    };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }
    const updatedCategory = await this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      select: categorySelect,
    });
    return {
      message: 'Categoria actualizada exitosamente',
      data: updatedCategory,
    };
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: categorySelect,
    });
    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }
    const deletedCategory = await this.prisma.category.delete({
      where: { id },
      select: categorySelect,
    });
    return {
      message: 'Categoria eliminada exitosamente',
      data: deletedCategory,
    };
  }
}
