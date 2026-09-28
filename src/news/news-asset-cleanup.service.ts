import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class NewsAssetCleanupService {
  private readonly logger = new Logger(NewsAssetCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupNewsAssets() {
    this.logger.log('Iniciando limpieza de NewsAssets (PENDING expirados y DELETE_PENDING)...');

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Seleccionamos PENDING expirados o DELETE_PENDING
    const assetsToCleanup = await this.prisma.newsAsset.findMany({
      where: {
        OR: [
          {
            status: 'PENDING',
            createdAt: { lt: yesterday },
          },
          {
            status: 'DELETE_PENDING',
          },
        ],
      },
    });

    if (assetsToCleanup.length === 0) {
      this.logger.log('No hay NewsAssets para limpiar.');
      return;
    }

    let deletedCount = 0;
    for (const asset of assetsToCleanup) {
      try {
        await this.storageService.deleteFileStrict(asset.storageKey);
        
        // Si el delete en storage fue exitoso (o ya no existía), borramos de DB
        await this.prisma.newsAsset.delete({ where: { id: asset.id } });
        deletedCount++;
      } catch (error) {
        // En caso de error de red/permisos, el asset se mantiene para el próximo intento
        this.logger.error(
          `Error limpiando NewsAsset ${asset.id} (storageKey: ${asset.storageKey}): ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.logger.log(`Limpieza finalizada. ${deletedCount} NewsAssets eliminados.`);
  }
}
