import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAccountCategoryDto } from './dto/create-account-category.dto';
import { UpdateAccountCategoryDto } from './dto/update-account-category.dto';
import { PrismaService } from 'src/prisma.service';
import { AccountCategoriesPaginationDto } from './dto/pagination.dto';
import { Prisma } from 'src/generated/prisma/client';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

@Injectable()
export class AccountCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAccountCategoryDto: CreateAccountCategoryDto, userId?: string) {
    const newCategory = await this.prisma.accountCategory.create({
      data: {
        ...createAccountCategoryDto,
        createdById: userId,
        updatedById: userId,
      },
    });
    return {
      message: 'Categoría de cuenta creada exitosamente',
      data: newCategory,
    };
  }

  async findAll(paginationDto: AccountCategoriesPaginationDto) {
    const { per_page = 10, page = 1, search, type, orderBy = 'asc' } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.AccountCategoryWhereInput = {};
    if (type) {
      where.type = type as any;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.accountCategory.count({ where }),
      this.prisma.accountCategory.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { name: orderBy },
      }),
    ]);

    return createPaginationResult(data, total, page, per_page);
  }

  async findOne(id: string) {
    const category = await this.prisma.accountCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return { data: category };
  }

  async update(id: string, updateAccountCategoryDto: UpdateAccountCategoryDto, userId?: string) {
    await this.findOne(id);
    const updatedCategory = await this.prisma.accountCategory.update({
      where: { id },
      data: {
        ...updateAccountCategoryDto,
        updatedById: userId,
      },
    });
    return {
      message: 'Categoría de cuenta actualizada exitosamente',
      data: updatedCategory,
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    // TODO: Verify if it has associated AccountCharges before deleting
    await this.prisma.accountCategory.delete({
      where: { id },
    });
    return { message: 'Categoría eliminada exitosamente' };
  }
}
