import { Test, TestingModule } from '@nestjs/testing';
import { NewsAssetService } from './news-asset.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('NewsAssetService', () => {
  let service: NewsAssetService;
  let prisma: any;
  let storage: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsAssetService,
        {
          provide: PrismaService,
          useValue: {
            newsAsset: {
              create: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFileStrict: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NewsAssetService>(NewsAssetService);
    prisma = module.get(PrismaService);
    storage = module.get(StorageService);
  });

  describe('uploadTemp', () => {
    it('creates PENDING asset and gets uploadedBy from context', async () => {
      storage.uploadFile.mockResolvedValue({ internalName: 'test-key', url: 'http://test.url' });
      prisma.newsAsset.create.mockResolvedValue({ id: '1', url: 'http://test.url' });

      const result = await service.uploadTemp({} as any, 'session1', 'user1');

      expect(storage.uploadFile).toHaveBeenCalled();
      expect(prisma.newsAsset.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          uploadSessionId: 'session1',
          uploadedById: 'user1',
          status: 'PENDING',
        }),
      }));
      expect(result).toEqual({ id: '1', url: 'http://test.url' });
    });

    it('cleans up storage if DB creation fails', async () => {
      storage.uploadFile.mockResolvedValue({ internalName: 'test-key', url: 'http://test.url' });
      prisma.newsAsset.create.mockRejectedValue(new Error('DB Error'));

      await expect(service.uploadTemp({} as any, 'session1', 'user1')).rejects.toThrow('DB Error');
      expect(storage.deleteFileStrict).toHaveBeenCalledWith('test-key');
    });
  });

  describe('cancelSession', () => {
    it('only removes current users PENDING assets for the session', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([
        { id: '1', storageKey: 'key1' },
      ]);

      await service.cancelSession('session1', 'user1');

      expect(prisma.newsAsset.findMany).toHaveBeenCalledWith({
        where: { uploadSessionId: 'session1', uploadedById: 'user1', status: 'PENDING' },
      });
      expect(storage.deleteFileStrict).toHaveBeenCalledWith('key1');
      expect(prisma.newsAsset.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('preserves metadata if storage delete fails', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([
        { id: '1', storageKey: 'key1' },
      ]);
      storage.deleteFileStrict.mockRejectedValue(new Error('Network Error'));

      await service.cancelSession('session1', 'user1');

      expect(prisma.newsAsset.delete).not.toHaveBeenCalled();
    });
  });

  describe('validateAssetsForSave', () => {
    it('rejects cross-user access', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([
        { id: '1', uploadedById: 'otherUser', status: 'PENDING', uploadSessionId: 'session1' }
      ]);
      await expect(service.validateAssetsForSave(['1'], 'session1', 'user1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects asset from another session', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([
        { id: '1', uploadedById: 'user1', status: 'PENDING', uploadSessionId: 'otherSession' }
      ]);
      await expect(service.validateAssetsForSave(['1'], 'session1', 'user1')).rejects.toThrow(ForbiddenException);
    });

    it('rejects asset from another News', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([
        { id: '1', uploadedById: 'user1', status: 'ATTACHED', newsId: 'otherNews' }
      ]);
      await expect(service.validateAssetsForSave(['1'], 'session1', 'user1', 'currentNews')).rejects.toThrow(ConflictException);
    });

    it('rejects missing asset', async () => {
      prisma.newsAsset.findMany.mockResolvedValue([]);
      await expect(service.validateAssetsForSave(['1'], 'session1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });
});
