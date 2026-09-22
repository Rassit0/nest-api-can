import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MatchLifecyclePolicy } from 'src/matches/utils/match-lifecycle.policy';
import { UpdateMatchCallUpBulkDto } from './dto/update-match-call-up-bulk.dto';
import { MatchSide, Prisma } from 'src/generated/prisma/client';

@Injectable()
export class MatchCallUpsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        homeCallUpConfiguredAt: true,
        awayCallUpConfiguredAt: true
      }
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const callUps = await this.prisma.matchCallUp.findMany({
      where: { matchId },
      include: {
        player: {
          select: {
            id: true,
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                imageUrl: true,
              }
            }
          }
        }
      },
      orderBy: [
        { player: { person: { lastName: 'asc' } } },
        { player: { person: { name: 'asc' } } }
      ]
    });

    return {
      matchId,
      home: callUps.filter(c => c.side === MatchSide.HOME),
      away: callUps.filter(c => c.side === MatchSide.AWAY),
      homeConfiguredAt: match.homeCallUpConfiguredAt,
      awayConfiguredAt: match.awayCallUpConfiguredAt,
    };
  }

  private async getEligibleMembershipsForSide(db: Prisma.TransactionClient | PrismaService, matchDate: Date, categoryId: string | null, playerIds?: string[]) {
    if (!categoryId) return [];

    return await db.playerMembership.findMany({
      where: {
        teamSeasonCategoryId: categoryId,
        startedAt: { lte: matchDate },
        OR: [
          { endedAt: null },
          { endedAt: { gte: matchDate } }
        ],
        ...(playerIds ? { playerId: { in: playerIds } } : {})
      },
      include: {
        player: {
          select: {
            id: true,
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                imageUrl: true,
              }
            }
          }
        }
      },
      orderBy: [
        { player: { person: { lastName: 'asc' } } },
        { player: { person: { name: 'asc' } } }
      ]
    });
  }

  async findCandidates(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { event: true }
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    const formatCandidates = (memberships: any[]) => {
      const uniquePlayers = new Map();
      for (const m of memberships) {
        if (!uniquePlayers.has(m.playerId)) {
          uniquePlayers.set(m.playerId, {
            playerId: m.playerId,
            firstName: m.player.person.name,
            lastName: m.player.person.lastName,
            imageUrl: m.player.person.imageUrl,
          });
        }
      }
      return Array.from(uniquePlayers.values());
    };

    const homeMemberships = await this.getEligibleMembershipsForSide(this.prisma, match.event.startDate, match.homeTeamSeasonCategoryId);
    const awayMemberships = await this.getEligibleMembershipsForSide(this.prisma, match.event.startDate, match.awayTeamSeasonCategoryId);

    return {
      home: formatCandidates(homeMemberships),
      away: formatCandidates(awayMemberships)
    };
  }

  async updateBulk(matchId: string, side: MatchSide, dto: UpdateMatchCallUpBulkDto) {
    const matchPre = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { eventId: true }
    });

    if (!matchPre) {
      throw new NotFoundException('Match not found');
    }

    // Reject isGuest = true per Phase B1 rules
    if (dto.players.some(p => p.isGuest)) {
      throw new BadRequestException('Guest players are not currently supported');
    }

    // Prevent duplicates in the incoming request
    const playerIds = dto.players.map(p => p.playerId);
    const uniqueIds = new Set(playerIds);
    if (uniqueIds.size !== playerIds.length) {
      throw new BadRequestException('A player cannot be duplicated in the call-up list');
    }

    // Perform atomic update
    await this.prisma.$transaction(async (tx) => {
      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, matchPre.eventId);
      MatchLifecyclePolicy.assertScheduled(lockedStatus, 'modificar la convocatoria de');

      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { event: true }
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      const matchDate = match.event.startDate;
      const targetCategory = side === MatchSide.HOME ? match.homeTeamSeasonCategoryId : match.awayTeamSeasonCategoryId;
      
      // Si el lado no tiene categoría (ej. equipo externo sin roster), no se pueden convocar jugadores
      if (!targetCategory && dto.players.length > 0) {
        throw new BadRequestException(`Cannot call up players for an external team without a managed roster on the ${side} side`);
      }

      // Prevent players from being in the opposite side
      const oppositeSide = side === MatchSide.HOME ? MatchSide.AWAY : MatchSide.HOME;
      const existingOpposite = await tx.matchCallUp.findMany({
        where: { matchId, side: oppositeSide }
      });
      
      const oppositeIds = existingOpposite.map(c => c.playerId);
      const inBothSides = playerIds.filter(id => oppositeIds.includes(id));
      if (inBothSides.length > 0) {
        throw new BadRequestException('A player cannot be in both HOME and AWAY call-ups');
      }

      // Verify Eligibility (PlayerMembership time-aware validation)
      if (playerIds.length > 0) {
        const memberships = await this.getEligibleMembershipsForSide(tx, matchDate, targetCategory, playerIds);

        const validPlayerIds = new Set(memberships.map(m => m.playerId));
        const invalidPlayers = playerIds.filter(id => !validPlayerIds.has(id));
        
        if (invalidPlayers.length > 0) {
          throw new BadRequestException(`One or more players do not have an active membership on the match date: ${invalidPlayers.join(', ')}`);
        }
      }

      // 1. Current state for smart sync
      const currentCallUps = await tx.matchCallUp.findMany({
        where: { matchId, side }
      });
      const currentPlayerIds = currentCallUps.map(c => c.playerId);
      const requestedPlayerIds = new Set(playerIds);
      
      // 2. Compute ADD and REMOVE (KEEP is implicitly untouched)
      const removedCallUps = currentCallUps.filter(c => !requestedPlayerIds.has(c.playerId));
      const addedPlayers = dto.players.filter(p => !currentPlayerIds.includes(p.playerId));

      // 3. Service Guard: check if any removed call up has a MatchLineup
      if (removedCallUps.length > 0) {
        const removedPlayerIds = removedCallUps.map(c => c.playerId);
        // Using callUpId check (C1B schema update)
        const lineupsCount = await tx.matchLineup.count({
          where: {
            callUpId: { in: removedCallUps.map(c => c.id) }
          }
        });

        if (lineupsCount > 0) {
          throw new BadRequestException('No puedes desconvocar jugadores que ya tienen participación o estadísticas registradas');
        }

        // 4. Delete REMOVE
        await tx.matchCallUp.deleteMany({
          where: { id: { in: removedCallUps.map(c => c.id) } }
        });
      }

      // 5. Insert ADD
      if (addedPlayers.length > 0) {
        await tx.matchCallUp.createMany({
          data: addedPlayers.map(p => ({
            matchId,
            playerId: p.playerId,
            side,
            isGuest: p.isGuest ?? false,
          }))
        });
      }

      // 6. Update configuredAt timestamp
      if (side === MatchSide.HOME) {
        await tx.match.update({
          where: { id: matchId },
          data: { homeCallUpConfiguredAt: new Date() }
        });
      } else if (side === MatchSide.AWAY) {
        await tx.match.update({
          where: { id: matchId },
          data: { awayCallUpConfiguredAt: new Date() }
        });
      }
    });

    return this.findAllByMatch(matchId);
  }
}
