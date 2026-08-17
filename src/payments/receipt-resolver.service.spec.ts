import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptResolverService } from './receipt-resolver.service';
import { PrismaService } from 'src/prisma.service';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('ReceiptResolverService', () => {
  let service: ReceiptResolverService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptResolverService,
        {
          provide: PrismaService,
          useValue: {
            charge: {
              findUnique: jest.fn(),
            },
            accountCategory: {
              findUnique: jest.fn(),
            },
            receiptSequence: {
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ReceiptResolverService>(ReceiptResolverService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveEffectiveCategory', () => {
    it('AccountCharge explicit priority (Priority 1)', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [{ 
          type: 'REGISTRATION',
          studentMembership: { courseSeason: { course: { school: { defaultAccountCategory: { code: 'ESC', isActive: true } } } } }
        }],
        membershipCharges: [],
        accountCharge: { categoryId: 'cat-123' },
      });
      (prismaService.accountCategory.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat-123',
        code: 'CAT-EXPLICITA',
        isActive: true,
      });

      const category = await service.resolveEffectiveCategory('charge-1');
      expect(category?.code).toBe('CAT-EXPLICITA');
    });

    it('StudentCharge -> School defaultAccountCategory (Priority 2)', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [{
          type: 'REGISTRATION',
          studentMembership: { courseSeason: { course: { school: { defaultAccountCategory: { code: 'ESC', isActive: true } } } } }
        }],
        membershipCharges: [],
        accountCharge: null,
      });

      const category = await service.resolveEffectiveCategory('charge-1');
      expect(category?.code).toBe('ESC');
    });

    it('MembershipCharge -> Club defaultAccountCategory (Priority 3)', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [],
        membershipCharges: [{
          type: 'REGISTRATION',
          playerMembership: { teamSeason: { team: { club: { defaultAccountCategory: { code: 'EQP', isActive: true } } } } }
        }],
        accountCharge: null,
      });

      const category = await service.resolveEffectiveCategory('charge-1');
      expect(category?.code).toBe('EQP');
    });

    it('Ambiguity (StudentCharge and MembershipCharge simultaneously)', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [{ type: 'REGISTRATION' }],
        membershipCharges: [{ type: 'REGISTRATION' }],
        accountCharge: null,
      });

      await expect(service.resolveEffectiveCategory('charge-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('Throws error if charge not found', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.resolveEffectiveCategory('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('Throws error if resolved category is inactive', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [],
        membershipCharges: [{
          type: 'REGISTRATION',
          playerMembership: { teamSeason: { team: { club: { defaultAccountCategory: { code: 'EQP', isActive: false } } } } }
        }],
        accountCharge: null,
      });

      await expect(service.resolveEffectiveCategory('charge-1')).rejects.toThrow(BadRequestException);
    });

    it('Fallback if no category (null)', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        studentCharges: [{
          type: 'REGISTRATION',
          studentMembership: { courseSeason: { course: { school: { defaultAccountCategory: null } } } }
        }],
        membershipCharges: [],
        accountCharge: null,
      });

      const category = await service.resolveEffectiveCategory('charge-1');
      expect(category).toBeNull();
    });
  });

  describe('resolveReceiptSeriesForCharge', () => {
    it('Escuela + cuota (RECURRING_FEE) -> ESC', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [{ type: 'RECURRING_FEE' }],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('ESC');
    });

    it('Escuela + cuota (SEASON_FEE) -> ESC', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [{ type: 'SEASON_FEE' }],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('ESC');
    });

    it('Escuela + matrícula -> ESC-MAT', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [{ type: 'REGISTRATION' }],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('ESC-MAT');
    });

    it('Escuela + recargo -> ESC-REC', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [{ type: 'LATE_FEE' }],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('ESC-REC');
    });

    it('Escuela + manual -> ESC-OTR', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [{ type: 'MANUAL' }],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('ESC-OTR');
    });

    it('Equipo + cuota (RECURRING_FEE) -> EQP', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [],
        membershipCharges: [{ type: 'RECURRING_FEE' }],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('EQP');
    });

    it('Equipo + matrícula -> EQP-MAT', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [],
        membershipCharges: [{ type: 'REGISTRATION' }],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('EQP-MAT');
    });

    it('Equipo + recargo -> EQP-REC', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [],
        membershipCharges: [{ type: 'LATE_FEE' }],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('EQP-REC');
    });

    it('Equipo + manual -> EQP-OTR', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: null,
        studentCharges: [],
        membershipCharges: [{ type: 'MANUAL' }],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('EQP-OTR');
    });

    it('AccountCharge personalizado -> serie propia', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue({
        id: 'charge-1',
        accountCharge: { category: { receiptSeries: 'MY-SERIES' } },
        studentCharges: [],
        membershipCharges: [],
      });
      expect(await service.resolveReceiptSeriesForCharge('charge-1')).toBe('MY-SERIES');
    });

    it('Fallback to GEN if no match', async () => {
      (prismaService.charge.findUnique as jest.Mock).mockResolvedValue(null);
      expect(await service.resolveReceiptSeriesForCharge('invalid-id')).toBe('GEN');
    });
  });
});
