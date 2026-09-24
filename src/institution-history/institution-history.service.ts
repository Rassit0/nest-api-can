import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateInstitutionHistorySettingsDto } from './dto/update-settings.dto';
import { CreateInstitutionHistoryItemDto } from './dto/create-item.dto';
import { UpdateInstitutionHistoryItemDto } from './dto/update-item.dto';

const SETTINGS_ID = 'institution-history';

@Injectable()
export class InstitutionHistoryService {
  private readonly logger = new Logger(InstitutionHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // --- SETTINGS ---
  async getSettings() {
    let settings = await this.prisma.institutionHistorySettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (!settings) {
      settings = await this.prisma.institutionHistorySettings.create({
        data: {
          id: SETTINGS_ID,
          title: 'Nuestra Historia',
          description: '',
        },
      });
    }
    return settings;
  }

  async updateSettings(
    dto: UpdateInstitutionHistorySettingsDto,
    file?: Express.Multer.File,
  ) {
    const settings = await this.getSettings();
    const { removeImage, ...updateData } = dto;

    let newImageUrl: string | undefined | null;
    let newInternalName: string | undefined;

    try {
      if (file) {
        // Validation: 16:9 ratio requested by user
        const result = await this.storageService.uploadFile(file, 'institution-history', {
          aspectRatio: '16:9',
          position: 'center',
        });
        newImageUrl = result.url;
        newInternalName = result.internalName;
      } else if (removeImage) {
        newImageUrl = null;
      }

      // Update DB
      const updated = await this.prisma.institutionHistorySettings.update({
        where: { id: SETTINGS_ID },
        data: {
          ...updateData,
          ...(newImageUrl !== undefined ? { imageUrl: newImageUrl } : {}),
        },
      });

      // Cleanup old image if it was replaced or removed
      if ((file || removeImage) && settings.imageUrl) {
        const oldInternal = this.storageService.extractInternalNameFromUrl(settings.imageUrl);
        if (oldInternal) {
          try {
            await this.storageService.deleteFile(oldInternal);
          } catch (e) {
            this.logger.error(`Failed to delete old history image: ${oldInternal}`, e);
          }
        }
      }

      return updated;
    } catch (error) {
      // Rollback if DB failed but image was uploaded
      if (newInternalName) {
        try {
          await this.storageService.deleteFile(newInternalName);
        } catch (e) {
          this.logger.error(`Failed to delete rollback image: ${newInternalName}`, e);
        }
      }
      throw error;
    }
  }

  // --- ITEMS ---
  async getItems(activeOnly = false) {
    return this.prisma.institutionHistoryItem.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async createItem(dto: CreateInstitutionHistoryItemDto) {
    return this.prisma.institutionHistoryItem.create({
      data: dto,
    });
  }

  async updateItem(id: string, dto: UpdateInstitutionHistoryItemDto) {
    const exists = await this.prisma.institutionHistoryItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Hito no encontrado');

    return this.prisma.institutionHistoryItem.update({
      where: { id },
      data: dto,
    });
  }

  async deleteItem(id: string) {
    const exists = await this.prisma.institutionHistoryItem.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Hito no encontrado');

    return this.prisma.institutionHistoryItem.delete({
      where: { id },
    });
  }
}
