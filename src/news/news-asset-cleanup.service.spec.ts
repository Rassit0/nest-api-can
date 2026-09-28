import { Test, TestingModule } from '@nestjs/testing';
import { NewsAssetCleanupService } from './news-asset-cleanup.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('NewsAssetCleanupService', () => {
  let service: NewsAssetCleanupService;
  let prisma: any;
  let storage: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsAssetCleanupService,
        {
          provide: PrismaService,
          useValue: {
            newsAsset: {
              findMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            deleteFileStrict: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NewsAssetCleanupService>(NewsAssetCleanupService);
    prisma = module.get(PrismaService);
    storage = module.get(StorageService);
  });

  it('cleans up expired PENDING and DELETE_PENDING assets', async () => {
    prisma.newsAsset.findMany.mockResolvedValue([
      { id: '1', storageKey: 'key1' }, // expired PENDING
      { id: '2', storageKey: 'key2' }, // DELETE_PENDING
    ]);

    await service.cleanupNewsAssets();

    expect(storage.deleteFileStrict).toHaveBeenCalledWith('key1');
    expect(storage.deleteFileStrict).toHaveBeenCalledWith('key2');
    expect(prisma.newsAsset.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(prisma.newsAsset.delete).toHaveBeenCalledWith({ where: { id: '2' } });
  });

  it('keeps metadata if storage delete fails (network error)', async () => {
    prisma.newsAsset.findMany.mockResolvedValue([
      { id: '1', storageKey: 'key1' },
    ]);
    storage.deleteFileStrict.mockRejectedValue(new Error('Network Error'));

    await service.cleanupNewsAssets();

    expect(storage.deleteFileStrict).toHaveBeenCalledWith('key1');
    expect(prisma.newsAsset.delete).not.toHaveBeenCalled();
  });
});
