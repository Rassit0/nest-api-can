import { Test, TestingModule } from '@nestjs/testing';
import { HeroHeroBannersService } from './heroHeroBanners.service';

import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('HeroHeroBannersService', () => {
  let service: HeroHeroBannersService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroHeroBannersService,
        {
          provide: PrismaService,
          useValue: {
            heroBanner: {
              findMany: jest.fn().mockResolvedValue([{ id: '1', isActive: true, sortOrder: 0 }]),
            }
          }
        },
        {
          provide: StorageService,
          useValue: {}
        }
      ],
    }).compile();

    service = module.get<HeroHeroBannersService>(HeroHeroBannersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findPublic without categorySlug', async () => {
    await service.findPublic();
    expect(prisma.heroBanner.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true }
    }));
  });

  it('findPublic with categorySlug', async () => {
    await service.findPublic('hero');
    expect(prisma.heroBanner.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, category: { slug: 'hero' } }
    }));
  });
});
