import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { StorageService } from '../storage/storage.service';
import { ImageProcessingOptions } from '../storage/image/image-processor.service';
import { PromotionPosition } from '../generated/prisma/client';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async uploadSafe(file: Express.Multer.File, uploadedList: string[], options?: ImageProcessingOptions): Promise<string> {
    const result = await this.storageService.uploadFile(file, 'promotions', options);
    uploadedList.push(result.internalName);
    return result.url;
  }

  private async deleteSafe(url: string) {
    if (!url) return;
    // For local storage provider we use the extractInternalNameFromUrl method
    // In banners it works the same way
    const internalName = (this.storageService as any).extractInternalNameFromUrl ? (this.storageService as any).extractInternalNameFromUrl(url) : null;
    if (internalName) {
      try {
        await (this.storageService as any).deleteFile(internalName);
      } catch (err) {
        this.logger.error(`Failed to delete old file: ${internalName}`, err);
      }
    }
  }

  async create(createPromotionDto: CreatePromotionDto, files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }) {
    const uploadedInternalNames: string[] = [];
    const urls: { image16x9?: string; image1x1?: string; image3x4?: string } = {};

    try {
      if (files.image16x9 && files.image16x9[0]) {
        urls.image16x9 = await this.uploadSafe(files.image16x9[0], uploadedInternalNames, { aspectRatio: '16:9', position: 'center' });
      }
      if (files.image1x1 && files.image1x1[0]) {
        urls.image1x1 = await this.uploadSafe(files.image1x1[0], uploadedInternalNames, { aspectRatio: '1:1', position: 'center' });
      }
      if (files.image3x4 && files.image3x4[0]) {
        urls.image3x4 = await this.uploadSafe(files.image3x4[0], uploadedInternalNames, { aspectRatio: '3:4', position: 'center' });
      }

      // If isActive is undefined in DTO, default is true based on schema.
      const shouldActivate = createPromotionDto.isActive !== false;

      return await this.prisma.$transaction(async (tx) => {
        if (shouldActivate) {
          await tx.promotion.updateMany({
            where: {
              position: createPromotionDto.position,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        return tx.promotion.create({
          data: {
            title: createPromotionDto.title,
            ctaText: createPromotionDto.ctaText,
            redirectTo: createPromotionDto.redirectTo,
            position: createPromotionDto.position,
            isActive: shouldActivate,
            image16x9: urls.image16x9!,
            image1x1: urls.image1x1,
            image3x4: urls.image3x4,
          },
        });
      });
    } catch (error) {
      // Rollback uploads if DB fails
      for (const internalName of uploadedInternalNames) {
        try {
          if ((this.storageService as any).deleteFile) {
            await (this.storageService as any).deleteFile(internalName);
          }
        } catch (err) {
          this.logger.error(`Failed to rollback file: ${internalName}`, err);
        }
      }
      throw error;
    }
  }

  async findAll(position?: PromotionPosition) {
    return this.prisma.promotion.findMany({
      where: position ? { position } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublic() {
    const activePromotions = await this.prisma.promotion.findMany({
      where: { isActive: true },
    });

    return {
      promo1: activePromotions.find((p) => p.position === PromotionPosition.PROMO_1) || null,
      promo2: activePromotions.find((p) => p.position === PromotionPosition.PROMO_2) || null,
    };
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id } });
    if (!promo) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }
    return promo;
  }

  async update(id: string, updatePromotionDto: UpdatePromotionDto, files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }) {
    const existing = await this.findOne(id);
    const uploadedInternalNames: string[] = [];
    const urlsToUpdate: { image16x9?: string; image1x1?: string; image3x4?: string } = {};

    try {
      if (files?.image16x9 && files.image16x9[0]) {
        urlsToUpdate.image16x9 = await this.uploadSafe(files.image16x9[0], uploadedInternalNames, { aspectRatio: '16:9', position: 'center' });
      }
      if (files?.image1x1 && files.image1x1[0]) {
        urlsToUpdate.image1x1 = await this.uploadSafe(files.image1x1[0], uploadedInternalNames, { aspectRatio: '1:1', position: 'center' });
      }
      if (files?.image3x4 && files.image3x4[0]) {
        urlsToUpdate.image3x4 = await this.uploadSafe(files.image3x4[0], uploadedInternalNames, { aspectRatio: '3:4', position: 'center' });
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const isActivating = (updatePromotionDto.isActive === true || (updatePromotionDto.isActive === undefined && existing.isActive)) && (updatePromotionDto.isActive === true && !existing.isActive);
        const targetPosition = updatePromotionDto.position || existing.position;

        // Si se cambia de inactivo a activo, o si se cambia la posicion y sigue activo
        const effectivelyActivating = (updatePromotionDto.isActive === true && !existing.isActive) ||
                                     ((updatePromotionDto.isActive === undefined || updatePromotionDto.isActive === true) && existing.isActive && targetPosition !== existing.position);

        if (effectivelyActivating) {
          await tx.promotion.updateMany({
            where: {
              position: targetPosition,
              isActive: true,
              id: { not: id },
            },
            data: { isActive: false },
          });
        }

        return tx.promotion.update({
          where: { id },
          data: {
            ...updatePromotionDto,
            ...urlsToUpdate,
          },
        });
      });

      // Cleanup old files safely outside the transaction if it succeeds
      if (urlsToUpdate.image16x9 && existing.image16x9) await this.deleteSafe(existing.image16x9);
      if (urlsToUpdate.image1x1 && existing.image1x1) await this.deleteSafe(existing.image1x1);
      if (urlsToUpdate.image3x4 && existing.image3x4) await this.deleteSafe(existing.image3x4);

      return updated;
    } catch (error) {
      for (const internalName of uploadedInternalNames) {
        try {
          if ((this.storageService as any).deleteFile) {
            await (this.storageService as any).deleteFile(internalName);
          }
        } catch (err) {}
      }
      throw error;
    }
  }

  async remove(id: string) {
    throw new ConflictException(
      'La eliminación física de promociones está deshabilitada para conservar el historial. Por favor, desactive la promoción en su lugar.'
    );
  }
}
