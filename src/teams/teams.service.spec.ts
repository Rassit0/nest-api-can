import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from 'src/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotFoundException } from '@nestjs/common';

describe('TeamsService', () => {
  let service: TeamsService;
  let prismaService: any;
  let storageService: any;

  beforeEach(async () => {
    prismaService = {
      team: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    storageService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      extractInternalNameFromUrl: jest.fn().mockReturnValue('teams/old-file.png'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
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

    service = module.get<TeamsService>(TeamsService);
    
    // We must mock findOne on the service itself since it uses it internally in update
    jest.spyOn(service, 'findOne').mockResolvedValue({
      data: { id: 'team-1', imageUrl: 'https://old.com/img.png' },
    } as any);
  });

  describe('create', () => {
    it('should create team without image (no uploadFile call)', async () => {
      prismaService.team.create.mockResolvedValue({ id: 'team-1' });

      await service.create({ name: 'Team A', shortName: 'TA', clubId: 'club-1', programGender: 'MALE', disciplineId: 'disc-1', ageCategoryId: 'cat-1' } as any);

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(prismaService.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Team A',
          clubId: 'club-1' // required relation is passed through
        }),
        select: expect.any(Object),
      });
    });

    it('should create team with image (calls uploadFile and persists URL)', async () => {
      prismaService.team.create.mockResolvedValue({ id: 'team-2' });
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/teams/new.png' });

      const mockImage = { buffer: Buffer.from('test') } as any;

      await service.create({ name: 'Team B', shortName: 'TB', clubId: 'club-1' } as any, mockImage);

      expect(storageService.uploadFile).toHaveBeenCalledWith(mockImage, 'teams');
      expect(prismaService.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Team B',
          imageUrl: 'https://storage.com/teams/new.png',
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('update', () => {
    it('should update without image (conserves old imageUrl, no upload, no delete)', async () => {
      prismaService.team.update.mockResolvedValue({ id: 'team-1' });

      await service.update('team-1', { name: 'Updated Team' } as any);

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(storageService.deleteFile).not.toHaveBeenCalled();
      // imageUrl should not be in the update payload if no new image is provided
      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: expect.not.objectContaining({ imageUrl: expect.anything() }),
        select: expect.any(Object),
      });
    });

    it('should update with new image (upload new, persist, delete old)', async () => {
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/teams/new.png' });
      prismaService.team.update.mockResolvedValue({ id: 'team-1' });

      const mockImage = { buffer: Buffer.from('test') } as any;

      await service.update('team-1', { name: 'Updated Team' } as any, mockImage);

      // Verify sequence of operations
      expect(storageService.uploadFile).toHaveBeenCalledWith(mockImage, 'teams');
      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: expect.objectContaining({ imageUrl: 'https://storage.com/teams/new.png' }),
        select: expect.any(Object),
      });
      // Delete happens after update
      expect(storageService.deleteFile).toHaveBeenCalledWith('teams/old-file.png');
    });

    it('should not delete old image if prisma update fails', async () => {
      storageService.uploadFile.mockResolvedValue({ url: 'https://storage.com/teams/new.png' });
      prismaService.team.update.mockRejectedValue(new Error('DB Error'));

      const mockImage = { buffer: Buffer.from('test') } as any;

      await expect(service.update('team-1', { name: 'Updated' } as any, mockImage)).rejects.toThrow('DB Error');

      expect(storageService.uploadFile).toHaveBeenCalled();
      expect(storageService.deleteFile).not.toHaveBeenCalled();
    });
  });
});
