import { Test, TestingModule } from '@nestjs/testing';
import { HomeDisciplinesService } from './homeDisciplines.service';

import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('HomeDisciplinesService', () => {
  let service: HomeDisciplinesService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeDisciplinesService,
        {
          provide: PrismaService,
          useValue: {
            homeDiscipline: {
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

    service = module.get<HomeDisciplinesService>(HomeDisciplinesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findPublic without categorySlug', async () => {
    await service.findPublic();
    expect(prisma.homeDiscipline.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true }
    }));
  });

  it('findPublic with categorySlug', async () => {
    await service.findPublic('hero');
    expect(prisma.homeDiscipline.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, category: { slug: 'hero' } }
    }));
  });
});
