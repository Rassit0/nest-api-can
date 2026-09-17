import { Test, TestingModule } from '@nestjs/testing';
import { NewsService } from './news.service';

import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('NewsService', () => {
  let service: NewsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        {
          provide: PrismaService,
          useValue: {
            news: {
              findMany: jest.fn().mockResolvedValue([{ id: '1', title: 'Test News' }]),
            }
          }
        },
        {
          provide: StorageService,
          useValue: {}
        }
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findPublic without limit', async () => {
    await service.findPublic();
    expect(prisma.news.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 20
    }));
  });

  it('findPublic with limit', async () => {
    await service.findPublic(undefined, 4);
    expect(prisma.news.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 4
    }));
  });

  it('findPublic with invalid limit (clamps to max 50)', async () => {
    await service.findPublic(undefined, 100);
    expect(prisma.news.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 50
    }));
  });
});
