import { Test, TestingModule } from '@nestjs/testing';
import { ClubsService } from './clubs.service';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from '../storage/storage.service';

describe('ClubsService', () => {
  let service: ClubsService;
  let prismaService: any;
  let storageService: any;

  beforeEach(async () => {
    prismaService = {
      institution: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inst-1' }),
      },
      teamSeason: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      club: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      extractInternalNameFromUrl: jest.fn().mockReturnValue('clubs/old-file.png'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: StorageService,
          useValue: storageService,
        },
      ],
    }).compile();

    service = module.get<ClubsService>(ClubsService);
  });

  describe('create', () => {
    it('should create club without image (no uploadFile call)', async () => {
      prismaService.club.create.mockResolvedValue({ id: 'club-1', isExternal: false });

      await service.create({ name: 'Club A', shortName: 'CA', disciplineId: 'disc-1', isExternal: false });

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(prismaService.club.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Club A',
          isExternal: false,
        }),
        select: expect.any(Object),
      });
    });

    it('should create club with image (calls uploadFile and persists URL)', async () => {
      prismaService.club.create.mockResolvedValue({ id: 'club-2' });
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/clubs/new.png' });

      const mockImage = { buffer: Buffer.from('test') } as any;

      await service.create({ name: 'Club B', shortName: 'CB', disciplineId: 'disc-1', isExternal: false }, mockImage);

      expect(storageService.uploadFile).toHaveBeenCalledWith(mockImage, 'clubs');
      expect(prismaService.club.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Club B',
          imageUrl: 'https://storage.com/clubs/new.png',
        }),
        select: expect.any(Object),
      });
    });

    it('should create club with isExternal=true', async () => {
      prismaService.club.create.mockResolvedValue({ id: 'club-3' });

      await service.create({ name: 'External Club', shortName: 'EXT', disciplineId: 'disc-1', isExternal: true });

      expect(prismaService.club.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isExternal: true,
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    it('should update without image (conserves old imageUrl, no upload, no delete)', async () => {
      prismaService.club.findUnique.mockResolvedValue({ id: 'club-1', imageUrl: 'https://old.com/img.png' });
      prismaService.club.update.mockResolvedValue({ id: 'club-1' });

      await service.update('club-1', { name: 'Updated Club' });

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(storageService.deleteFile).not.toHaveBeenCalled();
      // imageUrl should not be in the update payload if no new image is provided
      expect(prismaService.club.update).toHaveBeenCalledWith({
        where: { id: 'club-1' },
        data: expect.not.objectContaining({ imageUrl: expect.anything() }),
        select: expect.any(Object),
      });
    });

    it('should update with new image (upload new, persist, delete old)', async () => {
      prismaService.club.findUnique.mockResolvedValue({ id: 'club-1', imageUrl: 'https://old.com/img.png' });
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/clubs/new.png' });
      prismaService.club.update.mockResolvedValue({ id: 'club-1' });

      const mockImage = { buffer: Buffer.from('test') } as any;

      await service.update('club-1', { name: 'Updated Club' }, mockImage);

      // Verify sequence of operations
      expect(storageService.uploadFile).toHaveBeenCalledWith(mockImage, 'clubs');
      expect(prismaService.club.update).toHaveBeenCalledWith({
        where: { id: 'club-1' },
        data: expect.objectContaining({ imageUrl: 'https://storage.com/clubs/new.png' }),
        select: expect.any(Object),
      });
      // Delete happens after update
      expect(storageService.deleteFile).toHaveBeenCalledWith('clubs/old-file.png');
    });

    it('should not delete old image if prisma update fails', async () => {
      prismaService.club.findUnique.mockResolvedValue({ id: 'club-1', imageUrl: 'https://old.com/img.png' });
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/clubs/new.png' });
      prismaService.club.update.mockRejectedValue(new Error('DB Error'));

      const mockImage = { buffer: Buffer.from('test') } as any;

      await expect(service.update('club-1', { name: 'Updated' }, mockImage)).rejects.toThrow('DB Error');

      expect(storageService.uploadFile).toHaveBeenCalled();
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });
  });
});
