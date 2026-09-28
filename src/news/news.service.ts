import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsStatus, NewsAssetStatus, Prisma } from '../generated/prisma/client';
import { StorageService } from '../storage/storage.service';
import { generateSlug } from '../common/utils/slug.util';
import { NewsAssetService } from './news-asset.service';
import { validateAndDeriveStructuredContent } from './utils/structured-content.validator';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly newsAssetService: NewsAssetService,
  ) {}

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

  async create(createNewsDto: CreateNewsDto, userId: string, cover?: Express.Multer.File) {
    const { uploadSessionId, structuredContent, ...restDto } = createNewsDto;
    const slug = generateSlug(createNewsDto.title) + '-' + Date.now();
    let uploadedInternalName: string | null = null;
    let imageUrl: string | undefined = undefined;

    let finalContent = restDto.content || '';
    let validatedData: any = null;
    let extractedAssetIds = new Set<string>();
    let schemaVersion: number | null = null;

    if (structuredContent !== undefined && structuredContent !== null) {
      if (!uploadSessionId) {
        throw new BadRequestException('uploadSessionId is required for structured mode');
      }
      const validated = validateAndDeriveStructuredContent(structuredContent);
      validatedData = validated.sanitizedData;
      extractedAssetIds = validated.assetIds;
      finalContent = validated.derivedPlainText;
      schemaVersion = 1;

      // Validate assets before opening transaction
      await this.newsAssetService.validateAssetsForSave(
        Array.from(extractedAssetIds),
        uploadSessionId,
        userId
      );
    } else {
      if (!restDto.content) {
        throw new BadRequestException('content is required for legacy mode');
      }
    }

    try {
      if (cover) {
        const result = await this.storageService.uploadFile(cover, 'news');
        uploadedInternalName = result.internalName;
        imageUrl = result.url;
      }

      const createdNews = await this.prisma.$transaction(async (tx) => {
        const news = await tx.news.create({
          data: {
            ...restDto,
            content: finalContent,
            ...(validatedData !== null ? { structuredContent: validatedData } : {}),
            contentSchemaVersion: schemaVersion,
            slug,
            ...(imageUrl ? { imageUrl } : {}),
          },
        });

        if (schemaVersion === 1 && extractedAssetIds.size > 0) {
          await this.newsAssetService.attachPendingAssets(
            Array.from(extractedAssetIds),
            news.id,
            tx
          );
        }

        return news;
      });

      if (schemaVersion === 1 && uploadSessionId) {
        this.newsAssetService.cancelSession(uploadSessionId, userId).catch(e => {
          this.logger.error('Failed to cleanup unused PENDING assets', e);
        });
      }

      return createdNews;
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
    if (rest.structuredContent) {
      rest.structuredContent = await this.hydrateStructuredContentAssets(news.id, rest.structuredContent);
    }
    return rest;
  }

  async update(id: string, updateNewsDto: UpdateNewsDto, userId: string, cover?: Express.Multer.File) {
    const oldNews = await this.findOne(id);
    let uploadedInternalName: string | null = null;
    let newImageUrl: string | undefined = undefined;

    const { removeImageUrl, uploadSessionId, structuredContent, ...dataToUpdate } = updateNewsDto;

    let finalContent = oldNews.content;
    let newAssetIds = new Set<string>();
    let assetsToRemove = new Set<string>();
    
    let updateData: Prisma.NewsUpdateInput = { ...dataToUpdate };

    if (structuredContent !== undefined && structuredContent !== null) {
      if (!uploadSessionId) {
        throw new BadRequestException('uploadSessionId is required for structured mode');
      }
      const validated = validateAndDeriveStructuredContent(structuredContent);
      newAssetIds = validated.assetIds;
      finalContent = validated.derivedPlainText;

      await this.newsAssetService.validateAssetsForSave(
        Array.from(newAssetIds),
        uploadSessionId,
        userId,
        id
      );

      const oldAssets = await this.prisma.newsAsset.findMany({
        where: { newsId: id, status: 'ATTACHED' }
      });
      
      for (const oldAsset of oldAssets) {
        if (!newAssetIds.has(oldAsset.id)) {
          assetsToRemove.add(oldAsset.id);
        }
      }

      updateData.structuredContent = validated.sanitizedData;
      updateData.contentSchemaVersion = 1;
      updateData.content = finalContent;
    } else {
      if (dataToUpdate.content !== undefined) {
        updateData.content = dataToUpdate.content;
      }
    }

    try {
      if (cover) {
        const result = await this.storageService.uploadFile(cover, 'news');
        uploadedInternalName = result.internalName;
        newImageUrl = result.url;
      }

      if (newImageUrl) {
        updateData.imageUrl = newImageUrl;
      } else if (removeImageUrl) {
        updateData.imageUrl = null;
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.news.update({
          where: { id },
          data: updateData,
        });

        if (structuredContent !== undefined && structuredContent !== null) {
          if (newAssetIds.size > 0) {
            await this.newsAssetService.attachPendingAssets(
              Array.from(newAssetIds),
              id,
              tx
            );
          }
          if (assetsToRemove.size > 0) {
            await this.newsAssetService.markAssetsDeletePending(
              Array.from(assetsToRemove),
              tx
            );
          }
        }

        return result;
      });

      if (newImageUrl && oldNews.imageUrl) {
        await this.deleteSafe(oldNews.imageUrl);
      } else if (removeImageUrl && oldNews.imageUrl) {
        await this.deleteSafe(oldNews.imageUrl);
      }

      if (assetsToRemove.size > 0) {
        const removedAssets = await this.prisma.newsAsset.findMany({
          where: { id: { in: Array.from(assetsToRemove) } }
        });
        for (const asset of removedAssets) {
          try {
            await this.storageService.deleteFileStrict(asset.storageKey);
            await this.prisma.newsAsset.delete({ where: { id: asset.id } });
          } catch (e) {
            this.logger.error(`Failed physical delete for asset ${asset.id}`, e);
          }
        }
      }

      if (structuredContent !== undefined && structuredContent !== null && uploadSessionId) {
        this.newsAssetService.cancelSession(uploadSessionId, userId).catch(e => {
          this.logger.error('Failed to cleanup unused PENDING assets', e);
        });
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
    
    const assetsToRemove = await this.prisma.newsAsset.findMany({
      where: { newsId: id, status: 'ATTACHED' }
    });

    const deleted = await this.prisma.$transaction(async (tx) => {
      if (assetsToRemove.length > 0) {
        await this.newsAssetService.markAssetsDeletePending(
          assetsToRemove.map(a => a.id),
          tx
        );
      }
      return await tx.news.delete({ where: { id } });
    });

    if (news.imageUrl) {
      await this.deleteSafe(news.imageUrl);
    }
    
    if (assetsToRemove.length > 0) {
      for (const asset of assetsToRemove) {
        try {
          await this.storageService.deleteFileStrict(asset.storageKey);
          await this.prisma.newsAsset.delete({ where: { id: asset.id } });
        } catch (e) {
          this.logger.error(`Failed physical delete for asset ${asset.id}`, e);
        }
      }
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
        structuredContent: true,
        contentSchemaVersion: true,
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

    let hydratedStructuredContent = news.structuredContent;
    if (hydratedStructuredContent) {
      hydratedStructuredContent = await this.hydrateStructuredContentAssets(news.id, hydratedStructuredContent);
    }

    return {
      ...news,
      structuredContent: hydratedStructuredContent,
      category: news.category ? news.category.name : null,
    };
  }

  private async hydrateStructuredContentAssets(newsId: string, structuredContent: any) {
    if (!structuredContent || !structuredContent.content || !Array.isArray(structuredContent.content)) {
      return structuredContent;
    }

    const assetIds = new Set<string>();
    
    // 1. Extraer assetIds
    for (const block of structuredContent.content) {
      if (!block.props) continue;
      
      if (block.type === 'Image' || block.type === 'TextImage' || block.type === 'ImageText') {
        if (block.props.assetId) assetIds.add(block.props.assetId);
      } else if (block.type === 'Gallery' && Array.isArray(block.props.images)) {
        for (const img of block.props.images) {
          if (img.assetId) assetIds.add(img.assetId);
        }
      }
    }

    if (assetIds.size === 0) return structuredContent;

    // 2. Query assets (restringido a esta noticia y ATTACHED)
    const assets = await this.prisma.newsAsset.findMany({
      where: {
        id: { in: Array.from(assetIds) },
        newsId,
        status: NewsAssetStatus.ATTACHED,
      },
      select: { id: true, url: true }
    });
    
    if (assets.length === 0) return structuredContent;

    const urlMap = new Map(assets.map(a => [a.id, a.url]));

    // 3. Hydrate copy
    const hydratedContent = JSON.parse(JSON.stringify(structuredContent));

    for (const block of hydratedContent.content) {
      if (!block.props) continue;
      
      if (block.type === 'Image' || block.type === 'TextImage' || block.type === 'ImageText') {
        if (block.props.assetId) {
          block.props.url = urlMap.get(block.props.assetId);
        }
      } else if (block.type === 'Gallery' && Array.isArray(block.props.images)) {
        for (const img of block.props.images) {
          if (img.assetId) {
            img.url = urlMap.get(img.assetId);
          }
        }
      }
    }

    return hydratedContent;
  }
}
