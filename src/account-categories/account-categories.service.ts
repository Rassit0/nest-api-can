import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    let { code, ...rest } = createAccountCategoryDto;

    if (!code || code.trim() === '') {
      code = rest.name.replace(/\s+/g, '').substring(0, 4).toUpperCase();
      let isUnique = false;
      let suffix = 1;
      let finalCode = code;

      while (!isUnique) {
        const existing = await this.prisma.accountCategory.findUnique({ where: { code: finalCode } });
        if (!existing) {
          isUnique = true;
        } else {
          suffix++;
          finalCode = `${code}${suffix}`;
        }
      }
      code = finalCode;
    } else {
      code = code.trim().toUpperCase();
      const existing = await this.prisma.accountCategory.findUnique({ where: { code } });
      if (existing) throw new ConflictException(`Ya existe una categoría con el código ${code}.`);
    }

    const newCategory = await this.prisma.accountCategory.create({
      data: {
        ...rest,
        code,
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
    const { per_page = 10, page = 1, search, type, orderBy = 'asc', sortField = 'name' } = paginationDto;
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

    const validSortFields = ['name', 'description', 'type', 'code'];
    const field = validSortFields.includes(sortField) ? sortField : 'name';

    const [total, data] = await Promise.all([
      this.prisma.accountCategory.count({ where }),
      this.prisma.accountCategory.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { [field]: orderBy },
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
    
    if (updateAccountCategoryDto.code !== undefined) {
      if (updateAccountCategoryDto.code.trim() === '') {
        delete updateAccountCategoryDto.code;
      } else {
        updateAccountCategoryDto.code = updateAccountCategoryDto.code.trim().toUpperCase();
        const existing = await this.prisma.accountCategory.findUnique({ where: { code: updateAccountCategoryDto.code } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Ya existe otra categoría con el código ${updateAccountCategoryDto.code}.`);
        }
      }
    }

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
