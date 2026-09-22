import { Test, TestingModule } from '@nestjs/testing';
import { MatchesService } from './matches.service';
import { PrismaService } from 'src/prisma.service';
import { EventsService } from 'src/events/events.service';
import { BadRequestException } from '@nestjs/common';
import { MatchResult, EventStatus } from 'src/generated/prisma/client';

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
            teamSeasonStaff: {
              findMany: jest.fn(),
            },
            match: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            event: {
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
            $queryRaw: jest.fn().mockResolvedValue([{ status: EventStatus.SCHEDULED }]),
          },
        },
        {
          provide: EventsService,
          useValue: {
            executeEventCreation: jest.fn().mockImplementation((dto, userId, callback) => callback(prismaService, 'event-123')),
            executeEventUpdate: jest.fn().mockImplementation(async (id, dto, userId, callback) => {
              const mockedMatch = await prismaService.match.findUnique({ where: { id: 'any' } }) as any;
              if (mockedMatch?.event?.status === EventStatus.COMPLETED) {
                throw new BadRequestException('El evento ya se encuentra completado');
              }
              if (mockedMatch?.event?.status === EventStatus.CANCELLED) {
                throw new BadRequestException('El evento ya se encuentra cancelado');
              }
              const res = await callback(prismaService);
              return { event: {}, specific: res };
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    prismaService = module.get<PrismaService>(PrismaService);
    eventsService = module.get<EventsService>(EventsService);
  });

  describe('Match Integrity Matrix', () => {
    const canTeamId = 'can-team-id';
    const externalTeamId = 'external-team-id';
    const tscId = 'tsc-id';
    const tscId2 = 'tsc-id-2';

    beforeEach(() => {
      (prismaService.teamSeasonCategory.findUnique as jest.Mock).mockImplementation(async ({ where }) => {
        if (where.id === tscId) return { id: tscId, teamSeason: { teamId: canTeamId } };
        if (where.id === tscId2) return { id: tscId2, teamSeason: { teamId: canTeamId } };
        return null;
      });
      (prismaService.match.create as jest.Mock).mockResolvedValue({ specific: {} });
    });

    it('same Team + different Categories accepted (INTERNAL VS INTERNAL)', async () => {
      await expect(
        service.create({
          homeTeamId: canTeamId,
          awayTeamId: canTeamId,
          homeTeamSeasonCategoryId: tscId,
          awayTeamSeasonCategoryId: tscId2,
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          type: 'LEAGUE' as any,
        })
      ).resolves.toBeDefined();
    });

    it('should throw BadRequestException if same Team + same Category', async () => {
      await expect(
        service.create({
          homeTeamId: canTeamId,
          awayTeamId: canTeamId,
          homeTeamSeasonCategoryId: tscId,
          awayTeamSeasonCategoryId: tscId, 
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          type: 'LEAGUE' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('HOME category belonging to another Team is rejected', async () => {
      await expect(
        service.create({
          homeTeamId: 'wrong-team-id',
          awayTeamId: externalTeamId,
          homeTeamSeasonCategoryId: tscId, // belongs to canTeamId
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
          type: 'LEAGUE' as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('AWAY category belonging to another Team is rejected', async () => {
      await expect(
        service.create({
          homeTeamId: externalTeamId,
          awayTeamId: 'wrong-team-id',
          awayTeamSeasonCategoryId: tscId, // belongs to canTeamId
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
        homeTeamSeasonCategoryId: tscId,
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

    it('Create Match does NOT persist teamSeasonCategoryId legacy', async () => {
      await service.create({
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        homeTeamSeasonCategoryId: tscId,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        type: 'LEAGUE' as any,
      });
      expect(prismaService.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ teamSeasonCategoryId: expect.anything() })
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
        homeTeamSeasonCategoryId: tscId,
        homeScore: null,
        awayScore: null,
        event: {
          startDate: new Date(),
          status: EventStatus.SCHEDULED,
        },
        _count: { callUps: 0 },
      });
      (prismaService.match.update as jest.Mock).mockResolvedValue({ specific: {} });
    });

    it('should recalculate result dynamically on partial update without breaking due to missing startDate in mock', async () => {
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

    it('Update Match does NOT write teamSeasonCategoryId legacy', async () => {
      await service.update(matchId, {
        homeScore: 3,
        awayScore: 1,
      });

      expect(prismaService.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ teamSeasonCategoryId: expect.anything() })
        })
      );
    });
  });

  describe('Coach default calculation rules', () => {
    const tscId = 'tsc-id';
    
    const mockTsc = (staffs: any[]) => {
      (prismaService.teamSeasonCategory.findUnique as jest.Mock).mockResolvedValue({
        id: tscId,
        teamSeason: { team: { club: { isExternal: false } } },
        teamSeasonStaffs: staffs
      });
    };

    it('priority HEAD_COACH + isPrimary wins', async () => {
      mockTsc([
        { staff: { id: '1', isActive: true, person: { name: 'A', lastName: 'A' } }, role: 'ASISTENTE', isPrimary: true },
        { staff: { id: '2', isActive: true, person: { name: 'B', lastName: 'B' } }, role: 'HEAD_COACH', isPrimary: true },
        { staff: { id: '3', isActive: true, person: { name: 'C', lastName: 'C' } }, role: 'HEAD_COACH', isPrimary: false },
      ]);
      const result = await service.getTeamContext({ teamSeasonCategoryId: tscId, matchDate: new Date().toISOString() });
      expect(result.data.defaultCoach?.id).toBe('2');
    });

    it('HEAD_COACH wins over primary non-head coach', async () => {
      mockTsc([
        { staff: { id: '1', isActive: true, person: { name: 'A', lastName: 'A' } }, role: 'ASISTENTE', isPrimary: true },
        { staff: { id: '3', isActive: true, person: { name: 'C', lastName: 'C' } }, role: 'HEAD_COACH', isPrimary: false },
      ]);
      const result = await service.getTeamContext({ teamSeasonCategoryId: tscId, matchDate: new Date().toISOString() });
      expect(result.data.defaultCoach?.id).toBe('3');
    });

    it('primary fallback works when no HEAD_COACH', async () => {
      mockTsc([
        { staff: { id: '1', isActive: true, person: { name: 'A', lastName: 'A' } }, role: 'ASISTENTE', isPrimary: false },
        { staff: { id: '4', isActive: true, person: { name: 'D', lastName: 'D' } }, role: 'ASISTENTE', isPrimary: true },
      ]);
      const result = await service.getTeamContext({ teamSeasonCategoryId: tscId, matchDate: new Date().toISOString() });
      expect(result.data.defaultCoach?.id).toBe('4');
    });

    it('no eligible coach -> null', async () => {
      mockTsc([
        { staff: { id: '1', isActive: true, person: { name: 'A', lastName: 'A' } }, role: 'PREPARADOR_FISICO', isPrimary: false },
      ]);
      const result = await service.getTeamContext({ teamSeasonCategoryId: tscId, matchDate: new Date().toISOString() });
      expect(result.data.defaultCoach).toBeNull();
    });
  });

  describe('Lifecycle and Structural Guards', () => {
    const matchId = 'match-id';
    const canTeamId = 'can-team-id';
    const externalTeamId = 'external-team-id';

    it('should reject update if match is COMPLETED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        event: { status: EventStatus.COMPLETED, startDate: new Date() },
        _count: { callUps: 0 },
      });
      await expect(service.update(matchId, { homeScore: 1 })).rejects.toThrow('completado');
    });

    it('should reject update if match is CANCELLED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        event: { status: EventStatus.CANCELLED, startDate: new Date() },
        _count: { callUps: 0 },
      });
      await expect(service.update(matchId, { homeScore: 1 })).rejects.toThrow('cancelado');
    });

    it('should reject structural change if CallUps > 0', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        event: { status: EventStatus.SCHEDULED, startDate: new Date('2026-01-01') },
        _count: { callUps: 1 },
      });
      await expect(service.update(matchId, { startDate: new Date('2026-01-02').toISOString() })).rejects.toThrow('convocados');
    });

    it('should allow structural change if CallUps == 0', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        event: { status: EventStatus.SCHEDULED, startDate: new Date('2026-01-01') },
        _count: { callUps: 0 },
      });
      (prismaService.match.update as jest.Mock).mockResolvedValue({ specific: {} });
      await expect(service.update(matchId, { startDate: new Date('2026-01-02').toISOString() })).resolves.toBeDefined();
    });

    it('should allow non-structural change (score) even if CallUps > 0', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        homeTeamId: canTeamId,
        awayTeamId: externalTeamId,
        event: { status: EventStatus.SCHEDULED, startDate: new Date('2026-01-01') },
        _count: { callUps: 1 },
      });
      (prismaService.match.update as jest.Mock).mockResolvedValue({ specific: {} });
      await expect(service.update(matchId, { homeScore: 5 })).resolves.toBeDefined();
    });
  });

  describe('Same Team Validation', () => {
    beforeEach(() => {
      (prismaService.teamSeasonCategory.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.id === 'catA') return Promise.resolve({ teamSeason: { teamId: 'teamA' } });
        if (where.id === 'catB') return Promise.resolve({ teamSeason: { teamId: 'teamB' } });
        if (where.id === 'catA_alt') return Promise.resolve({ teamSeason: { teamId: 'teamA' } });
        return Promise.resolve(null);
      });
    });

    // Tests for validateMatchIntegrity rules
    it('Different teams -> allowed', async () => {
      const result = await (service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamB', 'catA', 'catB');
      expect(result).toBe('teamA');
    });

    it('Same Team / Category A vs Category B -> allowed', async () => {
      const result = await (service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamA', 'catA', 'catA_alt');
      expect(result).toBe('teamA');
    });

    it('Same Team / Category A vs Category A -> rejected', async () => {
      await expect((service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamA', 'catA', 'catA')).rejects.toThrow(BadRequestException);
    });

    it('Same Team / null vs Category B -> rejected', async () => {
      await expect((service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamA', null, 'catA_alt')).rejects.toThrow(BadRequestException);
    });

    it('Same Team / Category A vs null -> rejected', async () => {
      await expect((service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamA', 'catA', null)).rejects.toThrow(BadRequestException);
    });

    it('Same Team / null vs null -> rejected', async () => {
      await expect((service as any).validateMatchIntegrity(prismaService, 'teamA', 'teamA', null, null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Lifecycle Transitions', () => {
    const matchId = 'match-123';

    beforeEach(() => {
      (prismaService.event.update as jest.Mock).mockResolvedValue({});
    });

    it('should complete match if SCHEDULED and scores exist', async () => {
      (prismaService.match.findUnique as jest.Mock)
        .mockResolvedValueOnce({ eventId: 'event-123' })
        .mockResolvedValueOnce({
          id: matchId,
          eventId: 'event-123',
          homeScore: 1,
          awayScore: 0,
        });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.SCHEDULED }]);
      await expect(service.completeMatch(matchId)).resolves.toEqual({ message: 'Partido completado exitosamente' });
      expect(prismaService.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { status: EventStatus.COMPLETED },
      });
    });

    it('should reject complete match if scores are missing', async () => {
      (prismaService.match.findUnique as jest.Mock)
        .mockResolvedValueOnce({ eventId: 'event-123' })
        .mockResolvedValueOnce({
          id: matchId,
          eventId: 'event-123',
          homeScore: null,
          awayScore: 0,
        });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.SCHEDULED }]);
      await expect(service.completeMatch(matchId)).rejects.toThrow(BadRequestException);
    });

    it('should reject complete match if already COMPLETED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
        homeScore: 1,
        awayScore: 0,
      });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.COMPLETED }]);
      await expect(service.completeMatch(matchId)).rejects.toThrow('ya se encuentra');
    });

    it('should cancel match if SCHEDULED (no score required)', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
        homeScore: null,
        awayScore: null,
      });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.SCHEDULED }]);
      await expect(service.cancelMatch(matchId)).resolves.toEqual({ message: 'Partido cancelado exitosamente' });
      expect(prismaService.event.update).toHaveBeenCalledWith({
        where: { id: 'event-123' },
        data: { status: EventStatus.CANCELLED },
      });
    });

    it('should reopen match if COMPLETED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
      });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.COMPLETED }]);
      await expect(service.reopenMatch(matchId)).resolves.toEqual({ message: 'Partido reabierto exitosamente' });
    });

    it('should reject reopen match if SCHEDULED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
      });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.SCHEDULED }]);
      await expect(service.reopenMatch(matchId)).rejects.toThrow('ya se encuentra');
    });

    it('should restore match if CANCELLED', async () => {
      (prismaService.match.findUnique as jest.Mock).mockResolvedValue({
        id: matchId,
        eventId: 'event-123',
      });
      (prismaService.$queryRaw as jest.Mock).mockResolvedValueOnce([{ status: EventStatus.CANCELLED }]);
      await expect(service.restoreMatch(matchId)).resolves.toEqual({ message: 'Partido restaurado exitosamente' });
    });
  });
});

