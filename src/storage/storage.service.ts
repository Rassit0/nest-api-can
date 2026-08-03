import { Injectable, Inject, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { IStorageProvider } from './interfaces/storage-provider.interface';
import { PrismaService } from '../prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly storageProvider: IStorageProvider,
    private readonly prisma: PrismaService,
  ) {}

  async uploadFile(file: Express.Multer.File, folder?: string) {
    return this.storageProvider.uploadFile(file, folder);
  }

  async uploadMultipleFiles(files: Express.Multer.File[], userId?: string) {
    const uploadedAttachments = [];

    for (const file of files) {
      // 1. Guardar físicamente
      const uploadResult = await this.uploadFile(file, 'attachments');
      
      // 2. Crear registro en BD con estado PENDING
      const attachment = await this.prisma.attachment.create({
        data: {
          originalName: file.originalname,
          internalName: uploadResult.internalName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          url: uploadResult.url,
          uploadedById: userId,
          status: 'PENDING',
        },
      });

      uploadedAttachments.push(attachment);
    }

    return uploadedAttachments;
  }

  async deletePendingFile(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException('Archivo no encontrado');
    }

    if (attachment.status !== 'PENDING') {
      throw new ForbiddenException('No se puede eliminar un archivo que ya está enlazado a una entidad');
    }

    if (attachment.uploadedById !== userId) {
      throw new ForbiddenException('No tienes permisos para eliminar este archivo');
    }

    // 1. Eliminar físicamente
    await this.storageProvider.deleteFile(attachment.internalName);

    // 2. Eliminar de BD
    await this.prisma.attachment.delete({
      where: { id },
    });

    return { message: 'Archivo temporal eliminado con éxito' };
  }

  getFileUrl(internalName: string) {
    return this.storageProvider.getFileUrl(internalName);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupPendingAttachments() {
    this.logger.log('Iniciando limpieza de archivos temporales (PENDING) expirados...');

    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const expiredAttachments = await this.prisma.attachment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: yesterday,
        },
      },
    });

    if (expiredAttachments.length === 0) {
      this.logger.log('No hay archivos temporales expirados para limpiar.');
      return;
    }

    let deletedCount = 0;
    for (const att of expiredAttachments) {
      try {
        await this.storageProvider.deleteFile(att.internalName);
        await this.prisma.attachment.delete({ where: { id: att.id } });
        deletedCount++;
      } catch (error) {
        this.logger.error(`Error eliminando archivo expirado ${att.id}:`, error);
      }
    }

    this.logger.log(`Limpieza finalizada. ${deletedCount} archivos eliminados.`);
  }
}
