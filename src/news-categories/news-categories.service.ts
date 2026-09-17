import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNewsCategoryDto } from './dto/create-news-category.dto';
import { UpdateNewsCategoryDto } from './dto/update-news-category.dto';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class NewsCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateNewsCategoryDto) {
    const slug = generateSlug(createDto.name);
    
    const existing = await this.prisma.newsCategory.findUnique({
      where: { slug }
    });

    if (existing) {
      throw new ConflictException(`Ya existe una categoría de noticias con el slug '${slug}'`);
    }

    return this.prisma.newsCategory.create({
      data: {
        name: createDto.name,
        slug,
        isActive: createDto.isActive ?? true,
        sortOrder: createDto.sortOrder ?? 0,
      }
    });
  }

  findAll() {
    return this.prisma.newsCategory.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  findActive() {
    return this.prisma.newsCategory.findMany({
      where: { isActive: true },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.newsCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  async update(id: string, updateDto: UpdateNewsCategoryDto) {
    await this.findOne(id);
    
    return this.prisma.newsCategory.update({
      where: { id },
      data: {
        name: updateDto.name,
        isActive: updateDto.isActive,
        sortOrder: updateDto.sortOrder,
      }
    });
  }

  async findNewsSlugs(id: string) {
    const news = await this.prisma.news.findMany({
      where: { categoryId: id },
      select: { slug: true }
    });
    return news.map(n => n.slug);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    
    const newsCount = await this.prisma.news.count({
      where: { categoryId: id }
    });

    if (newsCount > 0) {
      throw new ConflictException('No se puede eliminar la categoría porque tiene noticias asociadas. Por favor, desactívela en su lugar.');
    }

    return this.prisma.newsCategory.delete({
      where: { id }
    });
  }
}
