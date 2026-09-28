import { Test, TestingModule } from '@nestjs/testing';
import { NewsService } from './news.service';
import { NewsAssetStatus } from '../generated/prisma/client';

import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';
import { NewsAssetService } from './news-asset.service';

jest.mock('sanitize-html', () => {
  return (text: string, options: any) => {
    if (options && options.allowedTags && options.allowedTags.length === 0) {
      return text.replace(/<[^>]+>/g, '');
    }
    return text;
  };
});

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
            $transaction: jest.fn((cb) => cb(prisma)),
            news: {
              create: jest.fn().mockResolvedValue({ id: 'n1', title: 'Test News' }),
              findMany: jest.fn().mockResolvedValue([{ id: 'n1', title: 'Test News' }]),
              findFirst: jest.fn().mockResolvedValue({ id: 'n1', title: 'Test News' }),
              findUnique: jest.fn().mockResolvedValue({ id: 'n1', title: 'Test', imageUrl: 'old.jpg' }),
              update: jest.fn().mockResolvedValue({ id: 'n1' }),
              delete: jest.fn().mockResolvedValue({ id: 'n1' }),
            },
            newsAsset: {
              findMany: jest.fn().mockResolvedValue([]),
              delete: jest.fn(),
            }
          }
        },
        {
          provide: StorageService,
          useValue: {
            extractInternalNameFromUrl: jest.fn().mockReturnValue('internal'),
            deleteFile: jest.fn(),
            deleteFileStrict: jest.fn(),
          }
        },
        {
          provide: NewsAssetService,
          useValue: {
            validateAssetsForSave: jest.fn().mockResolvedValue([]),
            attachPendingAssets: jest.fn(),
            markAssetsDeletePending: jest.fn(),
            cancelSession: jest.fn().mockResolvedValue(true),
          }
        }
      ],
    }).compile();

    service = module.get<NewsService>(NewsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create legacy news throws if content is absent', async () => {
    const dto: any = { title: 'T', excerpt: 'E' };
    await expect(service.create(dto, 'u1')).rejects.toThrow('content is required for legacy mode');
  });

  it('create legacy news succeeds', async () => {
    const dto: any = { title: 'T', excerpt: 'E', content: 'Cont' };
    await service.create(dto, 'u1');
    expect(prisma.news.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ content: 'Cont' })
    }));
  });

  it('create structured news succeeds and derives content', async () => {
    const structuredContent = {
      root: {},
      content: [{ type: 'Heading', props: { id: 'h1', text: 'Struc Content' } }]
    };
    const dto: any = { title: 'T', excerpt: 'E', uploadSessionId: 's1', structuredContent };
    await service.create(dto, 'u1');
    
    expect(prisma.news.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contentSchemaVersion: 1,
        content: expect.stringContaining('Struc Content'),
        structuredContent: expect.anything()
      })
    }));
  });

  it('update structured keeps old content if absent', async () => {
    prisma.news.findUnique.mockResolvedValue({ id: 'n1', content: 'Old', structuredContent: { root: {}, content: [] } });
    const dto: any = { excerpt: 'NewE' };
    await service.update('n1', dto, 'u1');

    expect(prisma.news.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        excerpt: 'NewE'
      })
    }));
    // Should NOT override structuredContent
    expect(prisma.news.update.mock.calls[0][0].data.structuredContent).toBeUndefined();
  });

  it('update structured sets new validated structuredContent', async () => {
    const structuredContent = {
      root: {},
      content: [{ type: 'Heading', props: { id: 'h1', text: 'New Struc Content' } }]
    };
    const dto: any = { excerpt: 'NewE', uploadSessionId: 's1', structuredContent };
    
    await service.update('n1', dto, 'u1');

    expect(prisma.news.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contentSchemaVersion: 1,
        content: expect.stringContaining('New Struc Content'),
        structuredContent: expect.anything()
      })
    }));
  });

  it('remove deletes news and marks attached assets DELETE_PENDING', async () => {
    prisma.newsAsset.findMany.mockResolvedValue([{ id: 'a1', storageKey: 'k1' }]);
    const newsAssetService = (service as any).newsAssetService;
    
    await service.remove('n1');

    expect(newsAssetService.markAssetsDeletePending).toHaveBeenCalledWith(['a1'], expect.anything());
    expect(prisma.news.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
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

  describe('Asset Hydration', () => {
    const fakeNewsId = 'n1';
    
    const setupAssetMock = (assets: any[]) => {
      prisma.newsAsset.findMany.mockResolvedValue(assets);
    };

    it('should hydrate Image, TextImage, ImageText, and Gallery URLs and preserve immutability', async () => {
      const sourceStructuredContent = {
        root: {},
        content: [
          { type: 'Image', props: { assetId: 'A' } },
          { type: 'TextImage', props: { assetId: 'B', text: 'txt', layout: '50-50' } },
          { type: 'ImageText', props: { assetId: 'C', text: 'txt2', layout: '60-40' } },
          { type: 'Gallery', props: { images: [{ assetId: 'D', alt: 'altD' }, { assetId: 'MISSING', alt: 'missing' }] } }
        ]
      };

      prisma.news.findUnique.mockResolvedValue({
        id: fakeNewsId,
        structuredContent: sourceStructuredContent,
        category: null
      });

      setupAssetMock([
        { id: 'A', url: 'url-a', newsId: fakeNewsId, status: NewsAssetStatus.ATTACHED },
        { id: 'B', url: 'url-b', newsId: fakeNewsId, status: NewsAssetStatus.ATTACHED },
        { id: 'C', url: 'url-c', newsId: fakeNewsId, status: NewsAssetStatus.ATTACHED },
        { id: 'D', url: 'url-d', newsId: fakeNewsId, status: NewsAssetStatus.ATTACHED }
      ]);

      const result = await service.findOne(fakeNewsId);

      // 9. Source Immutability
      expect((sourceStructuredContent.content[0] as any).props).not.toHaveProperty('url');

      const hydrated = (result.structuredContent as any).content;
      
      // 1. Image hydration
      expect(hydrated[0].props.url).toBe('url-a');
      expect(hydrated[0].props.assetId).toBe('A');

      // 2. TextImage hydration
      expect(hydrated[1].props.url).toBe('url-b');
      expect(hydrated[1].props.text).toBe('txt');
      expect(hydrated[1].props.layout).toBe('50-50');

      // 3. ImageText hydration
      expect(hydrated[2].props.url).toBe('url-c');
      expect(hydrated[2].props.text).toBe('txt2');

      // 4. Gallery hydration
      expect(hydrated[3].props.images[0].url).toBe('url-d');
      expect(hydrated[3].props.images[0].alt).toBe('altD');
      expect(hydrated[3].props.images[1].url).toBeUndefined(); // 8. Missing asset

      // 11. N+1 prevention: single query
      expect(prisma.newsAsset.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.newsAsset.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['A', 'B', 'C', 'D', 'MISSING'] },
          newsId: fakeNewsId,
          status: NewsAssetStatus.ATTACHED // 7. NON-ATTACHED blocked
        },
        select: { id: true, url: true }
      });

      // 10. No internal metadata exposed
      expect(hydrated[0].props).not.toHaveProperty('storageKey');
      expect(hydrated[0].props).not.toHaveProperty('status');
      
      // 13. Admin findOne hydration covered since we just called findOne
    });

    it('should prevent N+1 for duplicate assetIds and resolve correctly', async () => {
      const sourceStructuredContent = {
        root: {},
        content: [
          { type: 'Image', props: { assetId: 'A' } },
          { type: 'TextImage', props: { assetId: 'A', text: 'txt' } },
        ]
      };

      prisma.news.findUnique.mockResolvedValue({
        id: fakeNewsId,
        structuredContent: sourceStructuredContent,
        category: null
      });

      setupAssetMock([
        { id: 'A', url: 'url-a', newsId: fakeNewsId, status: NewsAssetStatus.ATTACHED }
      ]);

      prisma.newsAsset.findMany.mockClear();
      const result = await service.findOne(fakeNewsId);

      // 5. Duplicate assetId query test
      expect(prisma.newsAsset.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['A'] },
          newsId: fakeNewsId,
          status: NewsAssetStatus.ATTACHED
        },
        select: { id: true, url: true }
      });

      expect((result.structuredContent as any).content[0].props.url).toBe('url-a');
      expect((result.structuredContent as any).content[1].props.url).toBe('url-a');
    });

    it('should block hydration for assets not belonging to the current news (Cross-News)', async () => {
      const sourceStructuredContent = {
        root: {},
        content: [{ type: 'Image', props: { assetId: 'X' } }]
      };
      
      prisma.news.findUnique.mockResolvedValue({
        id: fakeNewsId,
        structuredContent: sourceStructuredContent,
        category: null
      });

      setupAssetMock([]); // Assets from another news are not returned because query includes newsId limit

      prisma.newsAsset.findMany.mockClear();
      const result = await service.findOne(fakeNewsId);

      // 6. Cross-News asset blocked check
      expect(prisma.newsAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ newsId: fakeNewsId })
      }));

      expect((result.structuredContent as any).content[0].props.url).toBeUndefined();
    });

    it('should hydrate findPublicBySlug correctly', async () => {
      prisma.news.findFirst.mockResolvedValue({
        id: fakeNewsId,
        slug: 'slug-1',
        contentSchemaVersion: 1,
        structuredContent: {
          root: {},
          content: [{ type: 'Image', props: { assetId: 'A' } }]
        },
        category: null
      });

      setupAssetMock([{ id: 'A', url: 'url-a' }]);

      const result = await service.findPublicBySlug('slug-1');

      // 12. findPublicBySlug hydration
      expect(result.contentSchemaVersion).toBe(1);
      expect((result.structuredContent as any).content[0].props.url).toBe('url-a');
    });
  });
});
