import { Test, TestingModule } from '@nestjs/testing';
import { MatchLineupsService } from './match-lineups.service';
import { PrismaService } from 'src/prisma.service';
import { MatchSide } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('MatchLineupsService', () => {
  let service: MatchLineupsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchLineupsService,
        {
          provide: PrismaService,
          useValue: {
            matchCallUp: {
              findMany: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            matchLineup: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            match: {
              findUnique: jest.fn().mockResolvedValue({ id: 'match-123', eventId: 'event-1', event: { status: 'SCHEDULED' } }),
            },
            $transaction: jest.fn().mockImplementation(async (callback) => {
              // Create a mock transaction client that just points back to our mocked prisma
              const tx = {
                matchCallUp: prisma.matchCallUp,
                matchLineup: prisma.matchLineup,
                $queryRaw: jest.fn().mockResolvedValue([{ status: 'SCHEDULED' }]),
              };
              return callback(tx);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MatchLineupsService>(MatchLineupsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMatchLineup', () => {
    it('should return empty arrays when Match has no CallUps', async () => {
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue([]);
      const result = await service.getMatchLineup('match-1');
      expect(result).toEqual({ home: [], away: [] });
    });

    it('should return HOME and AWAY CallUps independently with lineup null', async () => {
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue([
        { id: '1', side: MatchSide.HOME, matchId: 'match-1', playerId: 'p1', isGuest: false, createdAt: new Date(), updatedAt: new Date(), lineup: null, createdById: '', updatedById: '' } as any,
        { id: '2', side: MatchSide.AWAY, matchId: 'match-1', playerId: 'p2', isGuest: false, createdAt: new Date(), updatedAt: new Date(), lineup: null, createdById: '', updatedById: '' } as any,
      ]);
      const result = await service.getMatchLineup('match-1');
      expect(result.home.length).toBe(1);
      expect(result.away.length).toBe(1);
      expect(result.home[0].lineup).toBeNull();
    });
  });

  describe('updateMatchLineupSide', () => {
    it('should reject CallUp of another match or opposite side', async () => {
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue([]);
      await expect(
        service.updateMatchLineupSide('match-1', MatchSide.HOME, {
          lineups: [{ callUpId: 'invalid-id', isStarter: false, minutesPlayed: 10, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate callUpId', async () => {
      await expect(
        service.updateMatchLineupSide('match-1', MatchSide.HOME, {
          lineups: [
            { callUpId: 'dup', isStarter: false, minutesPlayed: 10, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
            { callUpId: 'dup', isStarter: false, minutesPlayed: 10, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
          ],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should ADD AWAY callup', async () => {
      const validCallUps = [
        { id: 'C', side: MatchSide.AWAY, matchId: 'match-1', playerId: 'p3', lineup: null } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany')
        .mockResolvedValueOnce(validCallUps)
        .mockResolvedValueOnce(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.AWAY, {
        lineups: [
          { callUpId: 'C', isStarter: true, minutesPlayed: 45, goals: 1, assists: 0, yellowCards: 0, redCards: 0 }
        ],
      }, 'user-away');

      expect(prisma.matchLineup.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ callUpId: 'C', minutesPlayed: 45, goals: 1, createdById: 'user-away' })
      }));
    });

    it('should UPDATE existente realmente cambia al menos un campo y conserva MatchLineup.id', async () => {
      const validCallUps = [
        { id: 'A', side: MatchSide.HOME, matchId: 'match-1', playerId: 'p1', lineup: { id: 'LA', callUpId: 'A', minutesPlayed: 90, isStarter: true, goals: 1, assists: 0, yellowCards: 0, redCards: 0 } } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.HOME, {
        lineups: [
          // Changing goals from 1 to 2
          { callUpId: 'A', isStarter: true, minutesPlayed: 90, goals: 2, assists: 0, yellowCards: 0, redCards: 0 }
        ],
      }, 'user-update');

      expect(prisma.matchLineup.update).toHaveBeenCalledWith({
        where: { id: 'LA' },
        data: expect.objectContaining({ goals: 2 })
      });
      expect(prisma.matchLineup.create).not.toHaveBeenCalled();
      expect(prisma.matchLineup.delete).not.toHaveBeenCalled();
    });

    it('should KEEP sin cambios -> no produce update/create/delete', async () => {
      const validCallUps = [
        { id: 'A', side: MatchSide.HOME, matchId: 'match-1', playerId: 'p1', lineup: { id: 'LA', callUpId: 'A', minutesPlayed: 90, isStarter: true, goals: 1, assists: 0, yellowCards: 0, redCards: 0 } } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.HOME, {
        lineups: [
          // Exact same data
          { callUpId: 'A', isStarter: true, minutesPlayed: 90, goals: 1, assists: 0, yellowCards: 0, redCards: 0 }
        ],
      });

      expect(prisma.matchLineup.update).not.toHaveBeenCalled();
      expect(prisma.matchLineup.create).not.toHaveBeenCalled();
      expect(prisma.matchLineup.delete).not.toHaveBeenCalled();
    });

    it('should REMOVE elimina MatchLineup pero preserva MatchCallUp', async () => {
      const validCallUps = [
        { id: 'A', side: MatchSide.HOME, matchId: 'match-1', playerId: 'p1', lineup: { id: 'LA', callUpId: 'A', minutesPlayed: 90, isStarter: true, goals: 1, assists: 0, yellowCards: 0, redCards: 0 } } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.HOME, {
        lineups: [] // Omitting A triggers REMOVE
      });

      expect(prisma.matchLineup.delete).toHaveBeenCalledWith({ where: { id: 'LA' } });
      expect(prisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
    });

    it('should HOME update no modifica AWAY (mismo Team base / categorA-as diferentes sigue aislado mediante MatchCallUp.side)', async () => {
      // Mock que devuelve los de HOME
      const validCallUps = [
        { id: 'A', side: MatchSide.HOME, matchId: 'match-1', playerId: 'p1', lineup: null } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.HOME, {
        lineups: [
          { callUpId: 'A', isStarter: true, minutesPlayed: 90, goals: 1, assists: 0, yellowCards: 0, redCards: 0 }
        ],
      });

      // Asegurar que `findMany` en la tx buscA3 estrictamente por { matchId, side: 'HOME' }
      expect(prisma.matchCallUp.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { matchId: 'match-1', side: MatchSide.HOME }
      }));
      // Por ende AWAY se mantiene intacto
    });

    it('should AWAY update no modifica HOME', async () => {
      const validCallUps = [
        { id: 'B', side: MatchSide.AWAY, matchId: 'match-1', playerId: 'p2', lineup: null } as any,
      ];
      jest.spyOn(prisma.matchCallUp, 'findMany').mockResolvedValue(validCallUps);

      await service.updateMatchLineupSide('match-1', MatchSide.AWAY, {
        lineups: [
          { callUpId: 'B', isStarter: true, minutesPlayed: 90, goals: 1, assists: 0, yellowCards: 0, redCards: 0 }
        ],
      });

      expect(prisma.matchCallUp.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { matchId: 'match-1', side: MatchSide.AWAY }
      }));
    });
  });
});
