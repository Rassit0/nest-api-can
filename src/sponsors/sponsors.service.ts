import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  private async uploadSafe(file: Express.Multer.File, uploadedList: string[]): Promise<string> {
    const result = await this.storageService.uploadFile(file, 'sponsors', { position: 'center' }); 
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

  async create(createSponsorDto: CreateSponsorDto, file: Express.Multer.File) {
    const uploadedInternalNames: string[] = [];
    let imageUrl: string;

    try {
      imageUrl = await this.uploadSafe(file, uploadedInternalNames);

      const websiteUrl = createSponsorDto.websiteUrl?.trim() || null;

      return await this.prisma.sponsor.create({
        data: {
          ...createSponsorDto,
          websiteUrl,
          imageUrl,
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
    return this.prisma.sponsor.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const sponsor = await this.prisma.sponsor.findUnique({
      where: { id },
    });
    if (!sponsor) throw new NotFoundException('Auspiciador no encontrado');
    return sponsor;
  }

  async update(id: string, updateSponsorDto: UpdateSponsorDto, file?: Express.Multer.File) {
    const sponsor = await this.findOne(id);
    
    const uploadedInternalNames: string[] = [];
    let newImageUrl: string | undefined;

    try {
      if (file) {
        newImageUrl = await this.uploadSafe(file, uploadedInternalNames);
      }

      let websiteUrl = updateSponsorDto.websiteUrl;
      if (websiteUrl !== undefined) {
        websiteUrl = websiteUrl?.trim() || null;
      }

      const updated = await this.prisma.sponsor.update({
        where: { id },
        data: {
          ...updateSponsorDto,
          ...(websiteUrl !== undefined && { websiteUrl }),
          ...(newImageUrl && { imageUrl: newImageUrl }),
        },
      });

      if (newImageUrl && sponsor.imageUrl) {
        await this.deleteSafe(sponsor.imageUrl);
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
    const sponsor = await this.findOne(id);
    await this.prisma.sponsor.delete({ where: { id } });

    if (sponsor.imageUrl) {
      await this.deleteSafe(sponsor.imageUrl);
    }

    return { message: 'Auspiciador eliminado exitosamente' };
  }
}
