import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class NewsAssetService {
  private readonly logger = new Logger(NewsAssetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async uploadTemp(file: Express.Multer.File, uploadSessionId: string, userId: string) {
    if (!uploadSessionId || uploadSessionId.trim() === '') {
      throw new BadRequestException('El uploadSessionId es requerido');
    }

    // 1. Process and upload object to Storage (safe order)
    let uploadResult;
    try {
      uploadResult = await this.storageService.uploadFile(file, 'news');
    } catch (error) {
      this.logger.error('Error al subir el archivo al almacenamiento', error);
      throw new BadRequestException('Error al subir el archivo');
    }

    // 2. Create NewsAsset PENDING
    try {
      const asset = await this.prisma.newsAsset.create({
        data: {
          storageKey: uploadResult.internalName,
          url: uploadResult.url,
          uploadSessionId,
          uploadedById: userId,
          status: 'PENDING',
        },
      });

      return {
        id: asset.id,
        url: asset.url,
      };
    } catch (dbError) {
      this.logger.error('Error al crear el registro NewsAsset en la base de datos', dbError);
      // Compensation: best-effort delete new object without hiding original error
      try {
        await this.storageService.deleteFileStrict(uploadResult.internalName);
      } catch (cleanupError) {
        this.logger.error(`Fallo al limpiar el almacenamiento tras un error en la base de datos para la clave ${uploadResult.internalName}`, cleanupError);
      }
      throw dbError; // Don't replace the original error
    }
  }

  async cancelSession(uploadSessionId: string, userId: string) {
    if (!uploadSessionId || uploadSessionId.trim() === '') {
      throw new BadRequestException('El uploadSessionId es requerido');
    }

    // Find all PENDING assets for this session and user
    const pendingAssets = await this.prisma.newsAsset.findMany({
      where: {
        uploadSessionId,
        uploadedById: userId,
        status: 'PENDING',
      },
    });

    let cleanedCount = 0;
    for (const asset of pendingAssets) {
      try {
        await this.storageService.deleteFileStrict(asset.storageKey);
        await this.prisma.newsAsset.delete({ where: { id: asset.id } });
        cleanedCount++;
      } catch (error) {
        this.logger.error(`Fallo al cancelar el recurso ${asset.id} en el almacenamiento, conservando metadatos para el cron`, error);
        // Do not throw, best effort + convergent
      }
    }

    return { success: true, cleanedCount };
  }

  // PRIMITIVES FOR FUTURE PHASE 4

  /**
   * Valida un conjunto de assets antes de ser guardados
   */
  async validateAssetsForSave(
    assetIds: string[],
    uploadSessionId: string,
    userId: string,
    newsId: string | null = null,
    prismaClient: Prisma.TransactionClient = this.prisma
  ) {
    if (!assetIds || assetIds.length === 0) return [];

    // Duplicate references treated as SET
    const uniqueAssetIds = [...new Set(assetIds)];

    const assets = await prismaClient.newsAsset.findMany({
      where: { id: { in: uniqueAssetIds } },
    });

    if (assets.length !== uniqueAssetIds.length) {
      throw new BadRequestException('Algunas imágenes o recursos no existen');
    }

    for (const asset of assets) {
      // Validate ownership
      if (asset.uploadedById !== userId) {
        throw new ForbiddenException(`No tienes permiso para usar el recurso ${asset.id}`);
      }

      if (asset.status === 'PENDING') {
        if (asset.uploadSessionId !== uploadSessionId) {
          throw new ForbiddenException(`El recurso ${asset.id} no pertenece a la sesión de subida actual`);
        }
      } else if (asset.status === 'ATTACHED') {
        if (!newsId) {
           throw new ConflictException(`El recurso ${asset.id} ya está adjunto a una noticia, pero se está creando una nueva`);
        }
        if (asset.newsId !== newsId) {
           throw new ConflictException(`El recurso ${asset.id} ya está adjunto a otra noticia diferente`);
        }
      } else if (asset.status === 'DELETE_PENDING') {
        throw new ConflictException(`El recurso ${asset.id} está marcado para eliminación y no puede ser usado`);
      }
    }

    return assets;
  }

  /**
   * Marca assets como DELETE_PENDING
   */
  async markAssetsDeletePending(assetIds: string[], prismaClient: Prisma.TransactionClient = this.prisma) {
    if (!assetIds || assetIds.length === 0) return;

    await prismaClient.newsAsset.updateMany({
      where: { id: { in: assetIds } },
      data: {
        status: 'DELETE_PENDING',
        newsId: null,
      },
    });
  }

  /**
   * Cambia estado PENDING -> ATTACHED
   */
  async attachPendingAssets(assetIds: string[], newsId: string, prismaClient: Prisma.TransactionClient = this.prisma) {
    if (!assetIds || assetIds.length === 0) return;

    await prismaClient.newsAsset.updateMany({
      where: {
        id: { in: assetIds },
        status: 'PENDING',
      },
      data: {
        status: 'ATTACHED',
        newsId,
      },
    });
  }
}
