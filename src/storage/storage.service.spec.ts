import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { PrismaService } from 'src/prisma.service';
import { ImageProcessorService } from './image/image-processor.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: 'STORAGE_PROVIDER',
          useValue: { upload: jest.fn(), getSignedUrl: jest.fn(), getPublicUrl: jest.fn() },
        },
        {
          provide: ImageProcessorService,
          useValue: { processImage: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractInternalNameFromUrl', () => {
    it('should extract internal name for clubs and teams', () => {
      expect(service.extractInternalNameFromUrl('https://storage.com/clubs/123e4567-e89b-12d3-a456-426614174000.png')).toBe('clubs/123e4567-e89b-12d3-a456-426614174000.png');
      expect(service.extractInternalNameFromUrl('https://storage.com/teams/123e4567-e89b-12d3-a456-426614174000.jpg')).toBe('teams/123e4567-e89b-12d3-a456-426614174000.jpg');
    });

    it('should preserve existing CMS contexts', () => {
      expect(service.extractInternalNameFromUrl('https://storage.com/news/123e4567-e89b-12d3-a456-426614174000.webp')).toBe('news/123e4567-e89b-12d3-a456-426614174000.webp');
      expect(service.extractInternalNameFromUrl('https://storage.com/promotions/123e4567-e89b-12d3-a456-426614174000.jpeg')).toBe('promotions/123e4567-e89b-12d3-a456-426614174000.jpeg');
      expect(service.extractInternalNameFromUrl('https://storage.com/hero-banners/123e4567-e89b-12d3-a456-426614174000.png')).toBe('hero-banners/123e4567-e89b-12d3-a456-426614174000.png');
    });

    it('should return null for invalid URLs', () => {
      expect(service.extractInternalNameFromUrl('https://storage.com/other/123e4567-e89b-12d3-a456-426614174000.png')).toBeNull();
      expect(service.extractInternalNameFromUrl('')).toBeNull();
    });
  });
});
