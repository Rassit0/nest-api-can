import { Test, TestingModule } from '@nestjs/testing';
import { MatchCallUpsService } from './match-call-ups.service';
import { PrismaService } from 'src/prisma.service';
import { MatchSide } from 'src/generated/prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateMatchCallUpBulkDto } from './dto/update-match-call-up-bulk.dto';

describe('MatchCallUpsService', () => {
  let service: MatchCallUpsService;
  let prisma: PrismaService;

  const mockPrisma = {
    matchCallUp: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    matchLineup: {
      count: jest.fn(),
    },
    match: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    playerMembership: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
    $queryRaw: jest.fn().mockResolvedValue([{ status: 'SCHEDULED' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchCallUpsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MatchCallUpsService>(MatchCallUpsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAllByMatch', () => {
    it('Debe retornar [] para un partido sin convocados', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        homeCallUpConfiguredAt: null,
        awayCallUpConfiguredAt: null,
      });
      mockPrisma.matchCallUp.findMany.mockResolvedValue([]);
      const result = await service.findAllByMatch('match-1');
      expect(result.home).toEqual([]);
      expect(result.away).toEqual([]);
    });

    it('Debe separar correctamente HOME y AWAY', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        homeCallUpConfiguredAt: null,
        awayCallUpConfiguredAt: null,
      });
      mockPrisma.matchCallUp.findMany.mockResolvedValue([
        { side: MatchSide.HOME, playerId: 'p1' },
        { side: MatchSide.AWAY, playerId: 'p2' },
      ]);
      const result = await service.findAllByMatch('match-1');
      expect(result.home).toHaveLength(1);
      expect(result.away).toHaveLength(1);
    });
  });

  describe('updateBulk', () => {
    const matchDate = new Date('2026-09-18');
    const matchId = 'match-1';
    
    beforeEach(() => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: matchId,
        homeTeamSeasonCategoryId: 'cat-home',
        awayTeamSeasonCategoryId: 'cat-away',
        event: { startDate: matchDate }
      });
      // Default to no existing opposite players and no existing call ups for this side
      mockPrisma.matchCallUp.findMany.mockResolvedValue([]);
      // Default to 0 lineups
      mockPrisma.matchLineup.count.mockResolvedValue(0);
      // Default to returning successful memberships
      mockPrisma.playerMembership.findMany.mockImplementation(({ where }) => {
        const playerIds = where.playerId.in;
        return Promise.resolve(playerIds.map(id => ({ playerId: id, startedAt: new Date('2026-01-01') })));
      });
    });

    it('Debe fallar (NotFoundException) si el partido no existe', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [] }))
        .rejects.toThrow(NotFoundException);
    });

    it('Debe permitir convocar jugadores a HOME si tienen membresía activa el día del partido (startDate)', async () => {
      await service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] });
      expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.matchCallUp.createMany).toHaveBeenCalled();
    });

    it('Debe permitir convocar jugadores a AWAY si tienen membresía activa el día del partido', async () => {
      await service.updateBulk(matchId, MatchSide.AWAY, { players: [{ playerId: 'p1' }] });
      expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.matchCallUp.createMany).toHaveBeenCalled();
    });

    it('Debe fallar (BadRequestException) si se intenta enviar isGuest: true', async () => {
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1', isGuest: true }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si un jugador está duplicado en el payload de la misma llamada', async () => {
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }, { playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si un jugador ya está en la convocatoria del equipo contrario (HOME vs AWAY)', async () => {
      // Mock existing players on AWAY
      mockPrisma.matchCallUp.findMany.mockResolvedValue([{ side: MatchSide.AWAY, playerId: 'p1' }]);
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si el jugador no tiene membresía', async () => {
      mockPrisma.playerMembership.findMany.mockResolvedValue([]);
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si el jugador tiene membresía pero empezó DESPUÉS de la fecha del partido', async () => {
      // Logic relies on Prisma query `where` clause; if Prisma returns [], it means they didn't match.
      mockPrisma.playerMembership.findMany.mockResolvedValue([]);
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si el jugador tiene membresía pero terminó ANTES de la fecha del partido', async () => {
      // Again, Prisma wouldn't return it
      mockPrisma.playerMembership.findMany.mockResolvedValue([]);
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Al hacer PUT sobre HOME, solo debe remover los eliminados de HOME (AWAY debe permanecer intacto)', async () => {
      // Mock existing player 'p2' that will be removed because payload only has 'p1'
      mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
        if (where.side === MatchSide.HOME) return Promise.resolve([{ id: 'uuid-p2', playerId: 'p2' }]);
        return Promise.resolve([]);
      });
      await service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] });
      
      expect(mockPrisma.matchCallUp.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['uuid-p2'] } }
      });
      // createMany called for p1
      expect(mockPrisma.matchCallUp.createMany).toHaveBeenCalled();
    });

    it('Debe vaciar HOME si se envía un array vacío sin afectar AWAY', async () => {
      mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
        if (where.side === MatchSide.HOME) return Promise.resolve([{ id: 'uuid-p1', playerId: 'p1' }]);
        return Promise.resolve([]);
      });
      await service.updateBulk(matchId, MatchSide.HOME, { players: [] });
      
      expect(mockPrisma.matchCallUp.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['uuid-p1'] } }
      });
      expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
    });

    it('Debe vaciar AWAY si se envía un array vacío sin afectar HOME', async () => {
      mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
        if (where.side === MatchSide.AWAY) return Promise.resolve([{ id: 'uuid-p1', playerId: 'p1' }]);
        return Promise.resolve([]);
      });
      await service.updateBulk(matchId, MatchSide.AWAY, { players: [] });
      
      expect(mockPrisma.matchCallUp.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['uuid-p1'] } }
      });
      expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
    });

    describe('Smart Sync & Stable IDs', () => {
      it('unchanged CallUp keeps same ID (Payload idéntico)', async () => {
        // Current: A, B
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' }
          ]);
          return Promise.resolve([]);
        });
        
        // Payload: A, B
        await service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pA' }, { playerId: 'pB' }] 
        });

        // Expected: no deletions, no creations
        expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
      });

      it('reordered payload creates/deletes nothing', async () => {
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' }
          ]);
          return Promise.resolve([]);
        });
        
        // Payload: B, A
        await service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pB' }, { playerId: 'pA' }] 
        });

        expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
      });

      it('adding Player does not recreate existing CallUps', async () => {
        // Current: A, B
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' }
          ]);
          return Promise.resolve([]);
        });
        
        // Payload: A, B, C
        await service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pA' }, { playerId: 'pB' }, { playerId: 'pC' }] 
        });

        expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.matchCallUp.createMany).toHaveBeenCalledWith({
          data: [{
            matchId: matchId,
            playerId: 'pC',
            side: MatchSide.HOME,
            isGuest: false
          }]
        });
      });

      it('removing Player only deletes removed CallUp', async () => {
        // Current: A, B, C
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' },
            { id: 'uuid-C', playerId: 'pC' }
          ]);
          return Promise.resolve([]);
        });
        
        // Payload: A, C
        await service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pA' }, { playerId: 'pC' }] 
        });

        expect(mockPrisma.matchCallUp.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['uuid-B'] } }
        });
        expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
      });
    });

    describe('C1C Configuration State', () => {
      it('first successful HOME save sets homeConfiguredAt and does not modify awayConfiguredAt', async () => {
        await service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] });
        
        expect(mockPrisma.match.update).toHaveBeenCalledWith({
          where: { id: matchId },
          data: { homeCallUpConfiguredAt: expect.any(Date) }
        });
        expect(mockPrisma.match.update).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: { awayCallUpConfiguredAt: expect.any(Date) } })
        );
      });

      it('first successful AWAY save sets awayConfiguredAt and does not modify homeConfiguredAt', async () => {
        await service.updateBulk(matchId, MatchSide.AWAY, { players: [{ playerId: 'p1' }] });
        
        expect(mockPrisma.match.update).toHaveBeenCalledWith({
          where: { id: matchId },
          data: { awayCallUpConfiguredAt: expect.any(Date) }
        });
        expect(mockPrisma.match.update).not.toHaveBeenCalledWith(
          expect.objectContaining({ data: { homeCallUpConfiguredAt: expect.any(Date) } })
        );
      });

      it('saving [] still marks side configured', async () => {
        await service.updateBulk(matchId, MatchSide.HOME, { players: [] });
        
        expect(mockPrisma.match.update).toHaveBeenCalledWith({
          where: { id: matchId },
          data: { homeCallUpConfiguredAt: expect.any(Date) }
        });
      });

      it('failed PUT does NOT mark configuredAt', async () => {
        // Mock a failure (e.g. duplicate player)
        await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }, { playerId: 'p1' }] }))
          .rejects.toThrow(BadRequestException);
        
        expect(mockPrisma.match.update).not.toHaveBeenCalled();
      });

      it('Lineup Guard failure does NOT mark configuredAt', async () => {
        mockPrisma.matchCallUp.findMany.mockResolvedValue([{ id: 'uuid-A', playerId: 'pA', side: MatchSide.HOME }]);
        mockPrisma.matchLineup.count.mockResolvedValue(1);
        
        await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [] }))
          .rejects.toThrow(BadRequestException);
        
        expect(mockPrisma.match.update).not.toHaveBeenCalled();
      });
    });

    describe('Lineup Guard', () => {
      it('blocks removal if player has Lineup (Partial deletion impossible)', async () => {
        // Current: A, B
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' }
          ]);
          return Promise.resolve([]);
        });
        
        // Player B has lineup
        mockPrisma.matchLineup.count.mockResolvedValue(1);
        
        // Payload: A
        await expect(service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pA' }] 
        })).rejects.toThrow(BadRequestException);

        expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.matchCallUp.createMany).not.toHaveBeenCalled();
      });

      it('allows keeping player with Lineup', async () => {
        // Current: A, B
        mockPrisma.matchCallUp.findMany.mockImplementation(({ where }) => {
          if (where.side === MatchSide.HOME) return Promise.resolve([
            { id: 'uuid-A', playerId: 'pA' },
            { id: 'uuid-B', playerId: 'pB' }
          ]);
          return Promise.resolve([]);
        });
        
        // Player B has lineup, but we don't even check if we keep them!
        // We only check removed players.
        mockPrisma.matchLineup.count.mockResolvedValue(0);
        
        // Payload: A, B, C
        await service.updateBulk(matchId, MatchSide.HOME, { 
          players: [{ playerId: 'pA' }, { playerId: 'pB' }, { playerId: 'pC' }] 
        });

        // B is kept, so no delete check happens
        expect(mockPrisma.matchCallUp.deleteMany).not.toHaveBeenCalled();
        expect(mockPrisma.matchCallUp.createMany).toHaveBeenCalled();
      });
    });

    it('Debe fallar (BadRequestException) si se intenta convocar a HOME y no hay homeTeamSeasonCategoryId (equipo externo)', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: matchId,
        homeTeamSeasonCategoryId: null,
        awayTeamSeasonCategoryId: 'cat-away',
        event: { startDate: matchDate }
      });
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('Debe fallar (BadRequestException) si se intenta convocar a AWAY y no hay awayTeamSeasonCategoryId (equipo externo)', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: matchId,
        homeTeamSeasonCategoryId: 'cat-home',
        awayTeamSeasonCategoryId: null,
        event: { startDate: matchDate }
      });
      await expect(service.updateBulk(matchId, MatchSide.AWAY, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });

    it('El bulk replace no debe realizar mutaciones sobre PlayerMembership', async () => {
      mockPrisma.playerMembership['create'] = jest.fn();
      mockPrisma.playerMembership['update'] = jest.fn();
      mockPrisma.playerMembership['delete'] = jest.fn();
      mockPrisma.playerMembership['deleteMany'] = jest.fn();
      
      await service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] });
      
      expect(mockPrisma.playerMembership['create']).not.toHaveBeenCalled();
      expect(mockPrisma.playerMembership['update']).not.toHaveBeenCalled();
      expect(mockPrisma.playerMembership['delete']).not.toHaveBeenCalled();
      expect(mockPrisma.playerMembership['deleteMany']).not.toHaveBeenCalled();
    });

    it('Debe fallar si el jugador pertenece al mismo club pero a otra categoría', async () => {
      // Prisma mock will not find the membership if we assert on teamSeasonCategoryId
      mockPrisma.playerMembership.findMany.mockImplementation(({ where }) => {
        // Mock that player membership is in 'other-cat' but the query searches for 'cat-home'
        if (where.teamSeasonCategoryId === 'cat-home') {
          return Promise.resolve([]);
        }
        return Promise.resolve([{ playerId: 'p1', startedAt: new Date('2026-01-01') }]);
      });
      await expect(service.updateBulk(matchId, MatchSide.HOME, { players: [{ playerId: 'p1' }] }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findCandidates', () => {
    const matchDate = new Date('2026-09-18');
    const matchId = 'match-1';

    beforeEach(() => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: matchId,
        homeTeamSeasonCategoryId: 'cat-home',
        awayTeamSeasonCategoryId: 'cat-away',
        event: { startDate: matchDate }
      });
    });

    it('Debe fallar (NotFoundException) si el partido no existe', async () => {
      mockPrisma.match.findUnique.mockResolvedValue(null);
      await expect(service.findCandidates(matchId)).rejects.toThrow(NotFoundException);
    });

    it('Debe retornar HOME y AWAY candidates desde sus respectivas categorías con ordenamiento determinista', async () => {
      mockPrisma.playerMembership.findMany.mockImplementation(({ where, orderBy }) => {
        expect(orderBy).toEqual([
          { player: { person: { lastName: 'asc' } } },
          { player: { person: { name: 'asc' } } }
        ]);
        if (where.teamSeasonCategoryId === 'cat-home') {
          return Promise.resolve([
            { playerId: 'p1', player: { person: { name: 'Juan', lastName: 'Perez', imageUrl: null } } },
          ]);
        }
        if (where.teamSeasonCategoryId === 'cat-away') {
          return Promise.resolve([
            { playerId: 'p2', player: { person: { name: 'Carlos', lastName: 'Gomez', imageUrl: null } } },
          ]);
        }
        return Promise.resolve([]);
      });

      const res = await service.findCandidates(matchId);
      expect(res.home).toHaveLength(1);
      expect(res.home[0].firstName).toBe('Juan');
      expect(res.away).toHaveLength(1);
      expect(res.away[0].firstName).toBe('Carlos');
    });

    it('Debe retornar [] si un lado no tiene categoría administrada', async () => {
      mockPrisma.match.findUnique.mockResolvedValue({
        id: matchId,
        homeTeamSeasonCategoryId: null,
        awayTeamSeasonCategoryId: 'cat-away',
        event: { startDate: matchDate }
      });

      mockPrisma.playerMembership.findMany.mockResolvedValue([
        { playerId: 'p2', player: { person: { name: 'Carlos', lastName: 'Gomez', imageUrl: null } } }
      ]);

      const res = await service.findCandidates(matchId);
      expect(res.home).toEqual([]);
      expect(res.away).toHaveLength(1);
      
      // Debe haber llamado findMany solo una vez (para AWAY)
      expect(mockPrisma.playerMembership.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
