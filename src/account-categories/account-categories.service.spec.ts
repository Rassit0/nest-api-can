import { Test, TestingModule } from '@nestjs/testing';
import { AccountCategoriesService } from './account-categories.service';
import { PrismaService } from 'src/prisma.service';
import { ConflictException } from '@nestjs/common';
import { ChargeDirection } from 'src/generated/prisma/client';

describe('AccountCategoriesService', () => {
  let service: AccountCategoriesService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      accountCategory: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountCategoriesService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AccountCategoriesService>(AccountCategoriesService);
  });

  describe('create', () => {
    it('should auto-generate code if empty', async () => {
      prismaService.accountCategory.findUnique
        .mockResolvedValueOnce({ id: '1' }) // first attempt fails
        .mockResolvedValueOnce(null); // second attempt succeeds
      
      prismaService.accountCategory.create.mockResolvedValue({ id: 'test' });

      await service.create({
        name: 'Mantenimiento ',
        type: ChargeDirection.PAYABLE,
      });

      // Mantenimiento without spaces -> MANT
      expect(prismaService.accountCategory.findUnique).toHaveBeenNthCalledWith(1, { where: { code: 'MANT' } });
      expect(prismaService.accountCategory.findUnique).toHaveBeenNthCalledWith(2, { where: { code: 'MANT2' } });
      
      expect(prismaService.accountCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Mantenimiento ',
          type: ChargeDirection.PAYABLE,
          code: 'MANT2', // Used the unique generated code
        }),
      });
    });

    it('should save manually provided code normalized', async () => {
      prismaService.accountCategory.findUnique.mockResolvedValue(null);
      prismaService.accountCategory.create.mockResolvedValue({ id: 'test' });

      await service.create({
        name: 'Mantenimiento',
        code: '  mnt  ', // Lowercase with spaces
        type: ChargeDirection.PAYABLE,
      });

      expect(prismaService.accountCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'MNT', // Trimmed and uppercase
        }),
      });
    });

    it('should reject if manual code is duplicated', async () => {
      prismaService.accountCategory.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          name: 'Mantenimiento',
          code: 'MNT',
          type: ChargeDirection.PAYABLE,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should allow changing code and normalize it', async () => {
      prismaService.accountCategory.findUnique
        .mockResolvedValueOnce({ id: '1', code: 'OLD' }) // findOne
        .mockResolvedValueOnce(null); // uniqueness check
        
      prismaService.accountCategory.update.mockResolvedValue({ id: '1' });

      await service.update('1', { code: '  new  ' });

      expect(prismaService.accountCategory.findUnique).toHaveBeenCalledWith({ where: { code: 'NEW' } });
      expect(prismaService.accountCategory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ code: 'NEW' }),
      });
    });

    it('should reject if code belongs to another category', async () => {
      prismaService.accountCategory.findUnique
        .mockResolvedValueOnce({ id: '1' }) // findOne
        .mockResolvedValueOnce({ id: '2' }); // uniqueness check found another cat
        
      await expect(
        service.update('1', { code: 'DUP' })
      ).rejects.toThrow(ConflictException);
    });

    it('should allow if code is the same as the category being edited', async () => {
      prismaService.accountCategory.findUnique
        .mockResolvedValueOnce({ id: '1' }) // findOne
        .mockResolvedValueOnce({ id: '1' }); // uniqueness check found same cat
        
      prismaService.accountCategory.update.mockResolvedValue({ id: '1' });

      await service.update('1', { code: 'SAME' });

      expect(prismaService.accountCategory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ code: 'SAME' }),
      });
    });

    it('should keep current code if no code is sent', async () => {
      prismaService.accountCategory.findUnique.mockResolvedValueOnce({ id: '1' }); // findOne
      prismaService.accountCategory.update.mockResolvedValue({ id: '1' });

      await service.update('1', { name: 'Renamed' });

      expect(prismaService.accountCategory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.not.objectContaining({ code: expect.anything() }),
      });
    });

    it('should keep current code if empty string is sent', async () => {
      prismaService.accountCategory.findUnique.mockResolvedValueOnce({ id: '1' }); // findOne
      prismaService.accountCategory.update.mockResolvedValue({ id: '1' });

      await service.update('1', { code: '   ' });

      expect(prismaService.accountCategory.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.not.objectContaining({ code: expect.anything() }),
      });
    });
  });
});
