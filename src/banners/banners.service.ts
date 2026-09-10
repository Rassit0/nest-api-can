import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { IStorageProvider } from '../storage/interfaces/storage-provider.interface';
import { STORAGE_PROVIDER } from '../storage/storage.service';

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
  ) {}

  async create(createBannerDto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: createBannerDto,
    });
  }

  async findAll() {
    return this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner no encontrado');
    return banner;
  }

  async update(id: string, updateBannerDto: UpdateBannerDto) {
    return this.prisma.banner.update({
      where: { id },
      data: updateBannerDto,
    });
  }

  async remove(id: string) {
    return this.prisma.banner.delete({ where: { id } });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    const result = await this.storageProvider.uploadFile(file, 'banners');
    return { url: result.url };
  }

  // --- MÉTODOS PÚBLICOS ---

  async findPublic() {
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        ctaText: true,
        redirectTo: true,
        image16x9: true,
        image1x1: true,
        image3x4: true,
        category: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: 'asc',
      }
    });
  }
}
