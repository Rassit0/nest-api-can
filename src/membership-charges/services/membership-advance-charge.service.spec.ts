import { Test, TestingModule } from '@nestjs/testing';
import { MembershipAdvanceChargeService } from './membership-advance-charge.service';
import { PrismaService } from 'src/prisma.service';
import { MembershipRepository } from '../repositories/membership.repository';
import { MembershipGenerationService } from './membership-generation.service';
import { MembershipPreviewService } from './membership-preview.service';
import { BadRequestException } from '@nestjs/common';
import {
  SeasonStatus,
  StatusTeamSeason,
  SeasonBillingType,
} from 'src/generated/prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('MembershipAdvanceChargeService', () => {
  let service: MembershipAdvanceChargeService;
  let prismaService: PrismaService;
  let membershipRepo: MembershipRepository;
  let generationService: MembershipGenerationService;
  let previewService: MembershipPreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipAdvanceChargeService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn().mockImplementation((cb) => cb({})),
          },
        },
        {
          provide: MembershipRepository,
          useValue: {
            getMembershipOrThrow: jest.fn(),
          },
        },
        {
          provide: MembershipGenerationService,
          useValue: {
            findNextUngeneratedCycles: jest.fn(),
            generateAdvanceCharges: jest.fn(),
          },
        },
        {
          provide: MembershipPreviewService,
          useValue: {
            buildChargesBreakdown: jest.fn(),
            extractAdvanceChargesFromCycles: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MembershipAdvanceChargeService>(
      MembershipAdvanceChargeService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
    membershipRepo = module.get<MembershipRepository>(MembershipRepository);
    generationService = module.get<MembershipGenerationService>(
      MembershipGenerationService,
    );
    previewService = module.get<MembershipPreviewService>(
      MembershipPreviewService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const getMockMembership = (overrides = {}) => ({
    id: 'mem-1',
    teamSeason: {
      status: StatusTeamSeason.ACTIVE,
      season: { status: SeasonStatus.ACTIVE },
      billingConfig: { billingType: SeasonBillingType.MONTHLY_ONLY },
    },
    paymentPlan: { isSinglePayment: false },
    ...overrides,
  });

  describe('previewAdvanceCharges', () => {
    it('should throw BadRequestException if season is inactive', async () => {
      const mockMembership = getMockMembership({
        teamSeason: {
          status: StatusTeamSeason.FINISHED,
          season: { status: SeasonStatus.FINISHED },
        },
      });
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );

      await expect(service.previewAdvanceCharges('mem-1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if billing is SINGLE_ONLY', async () => {
      const mockMembership = getMockMembership({
        teamSeason: {
          status: StatusTeamSeason.ACTIVE,
          season: { status: SeasonStatus.ACTIVE },
          billingConfig: { billingType: SeasonBillingType.SINGLE_ONLY },
        },
      });
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );

      await expect(service.previewAdvanceCharges('mem-1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if requesting more cycles than available', async () => {
      const mockMembership = getMockMembership();
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );
      (generationService.findNextUngeneratedCycles as jest.Mock).mockResolvedValue(
        [{ id: 'cycle1' }], // Only 1 cycle available
      );

      await expect(service.previewAdvanceCharges('mem-1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully preview charges', async () => {
      const mockMembership = getMockMembership();
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );
      const cycles = [{ id: 'cycle1' }, { id: 'cycle2' }];
      (generationService.findNextUngeneratedCycles as jest.Mock).mockResolvedValue(
        cycles,
      );
      (previewService.extractAdvanceChargesFromCycles as jest.Mock).mockReturnValue(
        { success: true },
      );

      const result = await service.previewAdvanceCharges('mem-1', 2);
      expect(result).toEqual({ success: true });
      expect(
        previewService.extractAdvanceChargesFromCycles,
      ).toHaveBeenCalledWith(cycles);
    });
  });

  describe('generateAdvanceCharges', () => {
    it('should successfully generate charges', async () => {
      const mockMembership = getMockMembership();
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );
      const cycles = [{ id: 'cycle1' }, { id: 'cycle2' }];
      (generationService.findNextUngeneratedCycles as jest.Mock).mockResolvedValue(
        cycles,
      );
      (generationService.generateAdvanceCharges as jest.Mock).mockResolvedValue(
        cycles.length,
      );

      const result = await service.generateAdvanceCharges('mem-1', 2);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(generationService.generateAdvanceCharges).toHaveBeenCalledWith(
        expect.anything(), // tx
        mockMembership,
        cycles,
      );
      expect(result.message).toContain('exitosamente 2 cuotas');
    });

    it('should handle unique constraint violations correctly', async () => {
      const mockMembership = getMockMembership();
      (membershipRepo.getMembershipOrThrow as jest.Mock).mockResolvedValue(
        mockMembership,
      );

      const error = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.x',
          meta: { target: ['unique_index'] },
        },
      );

      (prismaService.$transaction as jest.Mock).mockRejectedValue(error);

      await expect(service.generateAdvanceCharges('mem-1', 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
