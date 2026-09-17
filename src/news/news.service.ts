import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsStatus } from '../generated/prisma/client';
import { StorageService } from '../storage/storage.service';
import { generateSlug } from '../common/utils/slug.util';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // Removido generateSlug privado, ahora se usa el compartido

  private async deleteSafe(url: string) {
    const internalName = this.storageService.extractInternalNameFromUrl(url);
    if (internalName) {
      try {
        await this.storageService.deleteFile(internalName);
      } catch (err) {
        this.logger.error(`Failed to delete old file: ${internalName}`, err);
      }
    }
  }

  async create(createNewsDto: CreateNewsDto, cover?: Express.Multer.File) {
    const slug = generateSlug(createNewsDto.title) + '-' + Date.now();
    let uploadedInternalName: string | null = null;
    let imageUrl: string | undefined = undefined;

    try {
      if (cover) {
        const result = await this.storageService.uploadFile(cover, 'news');
        uploadedInternalName = result.internalName;
        imageUrl = result.url;
      }

      return await this.prisma.news.create({
        data: {
          ...createNewsDto,
          slug,
          ...(imageUrl ? { imageUrl } : {}),
        },
      });
    } catch (error) {
      if (uploadedInternalName) {
        try {
          await this.storageService.deleteFile(uploadedInternalName);
        } catch (e) {
          this.logger.error(`Compensatory deletion failed for: ${uploadedInternalName}`, e);
        }
      }
      throw error;
    }
  }

  async findAll() {
    const news = await this.prisma.news.findMany({
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    return news.map(n => {
      const { categoryId, ...rest } = n;
      return rest;
    });
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({ 
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        }
      }
    });
    if (!news) throw new NotFoundException('Noticia no encontrada');
    const { categoryId, ...rest } = news;
    return rest;
  }

  async update(id: string, updateNewsDto: UpdateNewsDto, cover?: Express.Multer.File) {
    const oldNews = await this.findOne(id);
    let uploadedInternalName: string | null = null;
    let newImageUrl: string | undefined = undefined;

    try {
      if (cover) {
        const result = await this.storageService.uploadFile(cover, 'news');
        uploadedInternalName = result.internalName;
        newImageUrl = result.url;
      }

      const { removeImageUrl, ...dataToUpdate } = updateNewsDto;

      const updated = await this.prisma.news.update({
        where: { id },
        data: {
          ...dataToUpdate,
          ...(newImageUrl
            ? { imageUrl: newImageUrl }
            : removeImageUrl
              ? { imageUrl: null }
              : {}),
        },
      });

      if (newImageUrl && oldNews.imageUrl) {
        await this.deleteSafe(oldNews.imageUrl);
      } else if (removeImageUrl && oldNews.imageUrl) {
        await this.deleteSafe(oldNews.imageUrl);
      }

      return updated;
    } catch (error) {
      if (uploadedInternalName) {
        try {
          await this.storageService.deleteFile(uploadedInternalName);
        } catch (e) {
          this.logger.error(`Compensatory deletion failed for: ${uploadedInternalName}`, e);
        }
      }
      throw error;
    }
  }

  async remove(id: string) {
    const news = await this.findOne(id);
    const deleted = await this.prisma.news.delete({ where: { id } });
    
    if (news.imageUrl) {
      await this.deleteSafe(news.imageUrl);
    }
    
    return deleted;
  }

  // --- MÉTODOS PÚBLICOS ---

  async findPublic(categoryId?: string, limit?: number) {
    const take = limit ? Math.min(Math.max(limit, 1), 50) : 20;
    
    const news = await this.prisma.news.findMany({
      where: {
        status: NewsStatus.PUBLISHED,
        ...(categoryId ? { categoryId } : {}),
        OR: [
          { publishedAt: { lte: new Date() } },
          { publishedAt: null }
        ]
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        imageUrl: true,
        category: {
          select: { id: true, name: true, slug: true }
        },
        publishedAt: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take,
    });
    return news.map(n => ({
      ...n,
      category: n.category ? n.category.name : null,
      categoryId: n.category ? n.category.id : null,
    }));
  }

  async findPublicBySlug(slug: string) {
    const news = await this.prisma.news.findFirst({
      where: {
        slug,
        status: NewsStatus.PUBLISHED,
        OR: [
          { publishedAt: { lte: new Date() } },
          { publishedAt: null }
        ]
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        category: {
          select: { id: true, name: true, slug: true }
        },
        tags: true,
        authorName: true,
        publishedAt: true,
      }
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada o no disponible');
    }

    return {
      ...news,
      category: news.category ? news.category.name : null,
    };
  }
}
