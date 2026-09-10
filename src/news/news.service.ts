import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsStatus } from '../generated/prisma/client';
import { IStorageProvider } from '../storage/interfaces/storage-provider.interface';
import { Inject } from '@nestjs/common';
import { STORAGE_PROVIDER } from '../storage/storage.service';

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
  ) {}

  // Generación simple de slug basada en título si se necesita, aunque asume que puede pasarse del frontend o auto-generarse.
  private generateSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
  }

  async create(createNewsDto: CreateNewsDto) {
    const slug = this.generateSlug(createNewsDto.title);
    return this.prisma.news.create({
      data: {
        ...createNewsDto,
        slug,
      },
    });
  }

  async findAll() {
    return this.prisma.news.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const news = await this.prisma.news.findUnique({ where: { id } });
    if (!news) throw new NotFoundException('Noticia no encontrada');
    return news;
  }

  async update(id: string, updateNewsDto: UpdateNewsDto) {
    return this.prisma.news.update({
      where: { id },
      data: updateNewsDto,
    });
  }

  async remove(id: string) {
    return this.prisma.news.delete({ where: { id } });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const result = await this.storageProvider.uploadFile(file, 'news');
    return { url: result.url };
  }

  // --- MÉTODOS PÚBLICOS ---

  async findPublic() {
    return this.prisma.news.findMany({
      where: {
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
        imageUrl: true,
        category: true,
        publishedAt: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 20, // Límite razonable por defecto sin paginación compleja
    });
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
        category: true,
        tags: true,
        authorName: true,
        publishedAt: true,
      }
    });

    if (!news) {
      throw new NotFoundException('Noticia no encontrada o no disponible');
    }

    return news;
  }
}
