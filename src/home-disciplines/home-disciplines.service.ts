import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateHomeDisciplineDto } from './dto/create-home-discipline.dto';
import { UpdateHomeDisciplineDto } from './dto/update-home-discipline.dto';
import { StorageService } from '../storage/storage.service';
import { ImageProcessingOptions } from '../storage/image/image-processor.service';

@Injectable()
export class HomeDisciplinesService {
  private readonly logger = new Logger(HomeDisciplinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async uploadSafe(file: Express.Multer.File, uploadedList: string[], options?: ImageProcessingOptions): Promise<string> {
    const result = await this.storageService.uploadFile(file, 'home-disciplines', options);
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

  async create(createHomeDisciplineDto: CreateHomeDisciplineDto, files: { image4x3?: Express.Multer.File[] }) {
    const uploadedInternalNames: string[] = [];
    const urls: { image4x3?: string } = {};

    try {
      if (files.image4x3 && files.image4x3[0]) {
        urls.image4x3 = await this.uploadSafe(files.image4x3[0], uploadedInternalNames, { aspectRatio: '4:3', position: 'center' });
      }

      return await this.prisma.homeDiscipline.create({
        data: {
          ...createHomeDisciplineDto,
          image4x3: urls.image4x3!,
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
    return this.prisma.homeDiscipline.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const homeDiscipline = await this.prisma.homeDiscipline.findUnique({
      where: { id },
    });
    if (!homeDiscipline) throw new NotFoundException('HomeDiscipline no encontrado');
    return homeDiscipline;
  }

  async update(id: string, updateHomeDisciplineDto: UpdateHomeDisciplineDto, files: { image4x3?: Express.Multer.File[] }) {
    const homeDiscipline = await this.findOne(id);
    const { ...updateData } = updateHomeDisciplineDto;
    
    const uploadedInternalNames: string[] = [];
    const newUrls: { image4x3?: string } = {};

    const oldUrlsToDelete: string[] = [];

    try {
      if (files.image4x3 && files.image4x3[0]) {
        newUrls.image4x3 = await this.uploadSafe(files.image4x3[0], uploadedInternalNames, { aspectRatio: '4:3', position: 'center' });
        oldUrlsToDelete.push(homeDiscipline.image4x3);
      }

      const updated = await this.prisma.homeDiscipline.update({
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
    const homeDiscipline = await this.findOne(id);
    await this.prisma.homeDiscipline.delete({ where: { id } });

    await this.deleteSafe(homeDiscipline.image4x3);

    return { message: 'HomeDiscipline eliminado exitosamente' };
  }
}
