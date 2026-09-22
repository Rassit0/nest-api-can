import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { MatchLifecyclePolicy } from 'src/matches/utils/match-lifecycle.policy';
import { MatchSide } from 'src/generated/prisma/client';
import { UpdateMatchLineupBulkDto } from './dto/update-match-lineup-bulk.dto';

@Injectable()
export class MatchLineupsService {
  private readonly logger = new Logger(MatchLineupsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMatchLineup(matchId: string) {
    // We get all CallUps for this match, regardless of whether they have a lineup.
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
              },
            },
          },
        },
        lineup: true,
      },
      orderBy: [
        { player: { person: { lastName: 'asc' } } },
        { player: { person: { name: 'asc' } } },
      ],
    });

    return {
      home: callUps.filter((c) => c.side === 'HOME'),
      away: callUps.filter((c) => c.side === 'AWAY'),
    };
  }

  async updateMatchLineupSide(
    matchId: string,
    side: MatchSide,
    dto: UpdateMatchLineupBulkDto,
    userId?: string,
  ) {
    const { lineups } = dto;

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { event: true },
    });

    if (!match) {
      throw new NotFoundException('El partido no existe');
    }

    // Validate duplicates in payload
    const callUpIds = lineups.map((l) => l.callUpId);
    if (new Set(callUpIds).size !== callUpIds.length) {
      throw new BadRequestException('El payload contiene callUpIds duplicados');
    }

    return await this.prisma.$transaction(async (tx) => {
      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, match.eventId);
      MatchLifecyclePolicy.assertScheduled(lockedStatus, 'modificar la planilla de');

      // 1. Fetch current callups for this match and side
      const validCallUps = await tx.matchCallUp.findMany({
        where: { matchId, side },
        include: { lineup: true },
      });

      const validCallUpIds = new Set(validCallUps.map((c) => c.id));

      // Validate all requested callups belong to this match and side
      for (const entry of lineups) {
        if (!validCallUpIds.has(entry.callUpId)) {
          throw new BadRequestException(
            `El jugador convocado con ID ${entry.callUpId} no existe, no pertenece a este partido o pertenece al equipo contrario`,
          );
        }
      }

      // Map existing lineups
      const currentLineupsMap = new Map();
      validCallUps.forEach((c) => {
        if (c.lineup) {
          currentLineupsMap.set(c.id, c.lineup);
        }
      });

      const requestedMap = new Map();
      lineups.forEach((l) => requestedMap.set(l.callUpId, l));

      // 2. Perform Smart Sync (KEEP, ADD, UPDATE, REMOVE)
      
      // REMOVE: Exists in DB, but not in payload
      for (const [callUpId, currentLineup] of currentLineupsMap.entries()) {
        if (!requestedMap.has(callUpId)) {
          await tx.matchLineup.delete({
            where: { id: currentLineup.id },
          });
        }
      }

      // ADD & UPDATE
      for (const entry of lineups) {
        const currentLineup = currentLineupsMap.get(entry.callUpId);

        if (!currentLineup) {
          // ADD
          await tx.matchLineup.create({
            data: {
              callUpId: entry.callUpId,
              isStarter: entry.isStarter,
              minutesPlayed: entry.minutesPlayed,
              goals: entry.goals,
              assists: entry.assists,
              yellowCards: entry.yellowCards,
              redCards: entry.redCards,
              createdById: userId,
              updatedById: userId,
            },
          });
        } else {
          // UPDATE or KEEP
          const hasChanged =
            currentLineup.isStarter !== entry.isStarter ||
            currentLineup.minutesPlayed !== entry.minutesPlayed ||
            currentLineup.goals !== entry.goals ||
            currentLineup.assists !== entry.assists ||
            currentLineup.yellowCards !== entry.yellowCards ||
            currentLineup.redCards !== entry.redCards;

          if (hasChanged) {
            await tx.matchLineup.update({
              where: { id: currentLineup.id },
              data: {
                isStarter: entry.isStarter,
                minutesPlayed: entry.minutesPlayed,
                goals: entry.goals,
                assists: entry.assists,
                yellowCards: entry.yellowCards,
                redCards: entry.redCards,
                updatedById: userId,
              },
            });
          }
        }
      }

      // 3. Return full updated side
      const finalCallUps = await tx.matchCallUp.findMany({
        where: { matchId, side },
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
                },
              },
            },
          },
          lineup: true,
        },
        orderBy: [
          { player: { person: { lastName: 'asc' } } },
          { player: { person: { name: 'asc' } } },
        ],
      });

      return {
        message: `Planilla del equipo ${side === 'HOME' ? 'local' : 'visitante'} actualizada exitosamente`,
        data: {
          [side.toLowerCase()]: finalCallUps,
        },
      };
    });
  }
}
