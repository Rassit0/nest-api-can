import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { StorageService } from '../storage/storage.service';
import { ImageProcessingOptions } from '../storage/image/image-processor.service';

@Injectable()
export class HeroBannersService {
  private readonly logger = new Logger(HeroBannersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async uploadSafe(file: Express.Multer.File, uploadedList: string[], options?: ImageProcessingOptions): Promise<string> {
    const result = await this.storageService.uploadFile(file, 'hero-banners', options);
    uploadedList.push(result.internalName);
    return result.url;
  }

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

  async create(createHeroBannerDto: CreateHeroBannerDto, files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }) {
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

      return await this.prisma.heroBanner.create({
        data: {
          ...createHeroBannerDto,
          image16x9: urls.image16x9!,
          image1x1: urls.image1x1,
          image3x4: urls.image3x4,
        },
      });
    } catch (error) {
      for (const internalName of uploadedInternalNames) {
        try {
          await this.storageService.deleteFile(internalName);
        } catch (e) {
          this.logger.error(`Compensatory deletion failed for: ${internalName}`, e);
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.heroBanner.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const heroBanner = await this.prisma.heroBanner.findUnique({
      where: { id },
    });
    if (!heroBanner) throw new NotFoundException('HeroBanner no encontrado');
    return heroBanner;
  }

  async update(id: string, updateHeroBannerDto: UpdateHeroBannerDto, files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }) {
    const heroBanner = await this.findOne(id);
    const { removeImage1x1, removeImage3x4, ...updateData } = updateHeroBannerDto;
    
    const uploadedInternalNames: string[] = [];
    const newUrls: { image16x9?: string; image1x1?: string | null; image3x4?: string | null } = {};

    const oldUrlsToDelete: string[] = [];

    try {
      if (files.image16x9 && files.image16x9[0]) {
        newUrls.image16x9 = await this.uploadSafe(files.image16x9[0], uploadedInternalNames, { aspectRatio: '16:9', position: 'center' });
        oldUrlsToDelete.push(heroBanner.image16x9);
      }
      if (files.image1x1 && files.image1x1[0]) {
        newUrls.image1x1 = await this.uploadSafe(files.image1x1[0], uploadedInternalNames, { aspectRatio: '1:1', position: 'center' });
        if (heroBanner.image1x1) oldUrlsToDelete.push(heroBanner.image1x1);
      } else if (removeImage1x1) {
        newUrls.image1x1 = null;
        if (heroBanner.image1x1) oldUrlsToDelete.push(heroBanner.image1x1);
      }
      if (files.image3x4 && files.image3x4[0]) {
        newUrls.image3x4 = await this.uploadSafe(files.image3x4[0], uploadedInternalNames, { aspectRatio: '3:4', position: 'center' });
        if (heroBanner.image3x4) oldUrlsToDelete.push(heroBanner.image3x4);
      } else if (removeImage3x4) {
        newUrls.image3x4 = null;
        if (heroBanner.image3x4) oldUrlsToDelete.push(heroBanner.image3x4);
      }

      const updated = await this.prisma.heroBanner.update({
        where: { id },
        data: {
          ...updateData,
          ...newUrls,
        },
      });

      for (const oldUrl of oldUrlsToDelete) {
        await this.deleteSafe(oldUrl);
      }

      return updated;
    } catch (error) {
      for (const internalName of uploadedInternalNames) {
        try {
          await this.storageService.deleteFile(internalName);
        } catch (e) {
          this.logger.error(`Compensatory deletion failed for: ${internalName}`, e);
        }
      }
      throw error;
    }
  }

  async remove(id: string) {
    const heroBanner = await this.findOne(id);
    await this.prisma.heroBanner.delete({ where: { id } });

    await this.deleteSafe(heroBanner.image16x9);
    if (heroBanner.image1x1) await this.deleteSafe(heroBanner.image1x1);
    if (heroBanner.image3x4) await this.deleteSafe(heroBanner.image3x4);

    return { message: 'HeroBanner eliminado exitosamente' };
  }
}
