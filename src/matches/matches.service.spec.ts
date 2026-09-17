import { Test, TestingModule } from '@nestjs/testing';
import { MatchesService } from './matches.service';
import { PrismaService } from 'src/prisma.service';
import { EventsService } from 'src/events/events.service';
import { BadRequestException } from '@nestjs/common';
import { MatchResult } from 'src/generated/prisma/client';

describe('MatchesService', () => {
  let service: MatchesService;
  let prismaService: PrismaService;
  let eventsService: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: PrismaService,
          useValue: {
            teamSeasonCategory: {
              findUnique: jest.fn(),
            },
            match: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: EventsService,
          useValue: {
            executeEventCreation: jest.fn().mockImplementation((dto, userId, callback) => callback({ match: prismaService.match }, 'event-123')),
            executeEventUpdate: jest.fn().mockImplementation((id, dto, userId, callback) => callback({ match: prismaService.match })),
          },
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventsService = module.get<EventsService>(EventsService);
  });

  describe('validateMatchIntegrity and calculateMatchResult (via create)', () => {
    const canTeamId = 'can-team-id';
    const externalTeamId = 'external-team-id';
    const otherTeamId = 'other-team-id';
    const tscId = 'tsc-id';

    beforeEach(() => {
      (prismaService.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({
        id: tscId,
        teamSeason: { teamId: canTeamId },
      });
      (prismaService.match.create as jest.Mock).mockResolvedValue({ specific: {} });
    });

    it('should throw BadRequestException if homeTeamId === awayTeamId', async () => {
      await expect(
        service.create({
          homeTeamId: canTeamId,
          awayTeamId: canTeamId,
          teamSeasonCategoryId: tscId,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          type: 'LEAGUE' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if CAN team is not participating', async () => {
      await expect(
        service.create({
          homeTeamId: externalTeamId,
          awayTeamId: otherTeamId,
          teamSeasonCategoryId: tscId,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          type: 'LEAGUE' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should assign PENDING if scores are missing', async () => {
      await service.create({
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        teamSeasonCategoryId: tscId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.PENDING }),
        })
      );
    });

    it('should assign WIN if CAN is home and wins', async () => {
      await service.create({
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: 3,
        awayScore: 1,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.WIN }),
        })
      );
    });

    it('should assign LOSS if CAN is home and loses', async () => {
      await service.create({
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: 1,
        awayScore: 3,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.LOSS }),
        })
      );
    });

    it('should assign WIN if CAN is away and wins', async () => {
      await service.create({
        homeTeamId: externalTeamId,
        awayTeamId: canTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: 1,
        awayScore: 2,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.WIN }),
        })
      );
    });

    it('should assign LOSS if CAN is away and loses', async () => {
      await service.create({
        homeTeamId: externalTeamId,
        awayTeamId: canTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: 2,
        awayScore: 1,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.LOSS }),
        })
      );
    });

    it('should assign DRAW if scores are equal', async () => {
      await service.create({
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: 2,
        awayScore: 2,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });

      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.DRAW }),
        })
      );
    });
  });

  describe('update match', () => {
    const matchId = 'match-id';
    const canTeamId = 'can-team-id';
    const externalTeamId = 'external-team-id';
    const tscId = 'tsc-id';

    beforeEach(() => {
      (prismaService.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({
        id: tscId,
        teamSeason: { teamId: canTeamId },
      });
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        teamSeasonCategoryId: tscId,
        homeScore: null,
        awayScore: null,
      });
      (prismaService.match.update as jest.Mock).mockResolvedValue({ specific: {} });
    });

    it('should recalculate result dynamically on partial update', async () => {
      await service.update(matchId, {
        homeScore: 3,
        awayScore: 1,
      });

      expect(prismaService.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: MatchResult.WIN }),
        })
      );
    });

    it('should throw BadRequestException if update breaks integrity', async () => {
      await expect(
        service.update(matchId, {
          homeTeamId: 'another-external-team',
          awayTeamId: externalTeamId,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
