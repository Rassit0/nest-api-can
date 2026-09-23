import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { MatchLifecyclePolicy } from './utils/match-lifecycle.policy';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma, EventType, EventStatus, TeamSeasonCategoryStatus, StatusTeamSeason, SeasonStatus, MatchResult } from 'src/generated/prisma/client';
import { MatchesPaginationDto } from './dto/pagination.dto';
import { FindPublicFixtureDto } from './dto/find-public-fixture.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { EventsService } from 'src/events/events.service';
import { BaseEventCreateDto, BaseEventUpdateDto } from 'src/events/dto/base-event.dto';

export const matchSelect: Prisma.MatchSelect = {
  id: true,
  homeTeamId: true,
  awayTeamId: true,
  type: true,
  homeScore: true,
  awayScore: true,
  result: true,
  competitionName: true,
  homeCoachId: true,
  homeCoachName: true,
  awayCoachId: true,
  awayCoachName: true,
  event: {
    select: {
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      location: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  },
  homeTeamSeasonCategory: {
    select: {
      id: true,
      category: { select: { id: true, name: true } },
      teamSeason: {
        select: {
          id: true,
          team: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              club: {
                select: {
                  id: true,
                  name: true,
                  isExternal: true,
                  discipline: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  awayTeamSeasonCategory: {
    select: {
      id: true,
      category: { select: { id: true, name: true } },
      teamSeason: {
        select: {
          id: true,
          team: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              club: {
                select: {
                  id: true,
                  name: true,
                  isExternal: true,
                  discipline: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  homeTeam: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    }
  },
  awayTeam: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
    }
  }
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger('MatchesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  private async validateMatchIntegrity(
    db: Prisma.TransactionClient | PrismaService,
    homeTeamId: string, 
    awayTeamId: string, 
    homeTeamSeasonCategoryId?: string | null,
    awayTeamSeasonCategoryId?: string | null
  ): Promise<string> {
    if (homeTeamId === awayTeamId) {
      const validSameTeamMatch = 
        homeTeamSeasonCategoryId != null && 
        awayTeamSeasonCategoryId != null && 
        homeTeamSeasonCategoryId !== awayTeamSeasonCategoryId;
        
      if (!validSameTeamMatch) {
        throw new BadRequestException('Un equipo no puede jugar contra sí mismo a menos que lo haga en categorías diferentes');
      }
    }

    let canTeamId: string | null = null;

    if (homeTeamSeasonCategoryId) {
      const homeTsc = await db.teamSeasonCategory.findUnique({
        where: { id: homeTeamSeasonCategoryId },
        include: { teamSeason: true }
      });
      if (!homeTsc) {
        throw new BadRequestException('Categoría local no encontrada');
      }
      if (homeTsc.teamSeason.teamId !== homeTeamId) {
        throw new BadRequestException('La categoría local no pertenece al equipo local');
      }
      canTeamId = homeTeamId;
    }

    if (awayTeamSeasonCategoryId) {
      const awayTsc = await db.teamSeasonCategory.findUnique({
        where: { id: awayTeamSeasonCategoryId },
        include: { teamSeason: true }
      });
      if (!awayTsc) {
        throw new BadRequestException('Categoría visitante no encontrada');
      }
      if (awayTsc.teamSeason.teamId !== awayTeamId) {
        throw new BadRequestException('La categoría visitante no pertenece al equipo visitante');
      }
      canTeamId = canTeamId || awayTeamId;
    }

    return canTeamId || homeTeamId;
  }

  private async validateCoachEligibility(db: Prisma.TransactionClient | PrismaService, coachId: string, teamId: string, matchDate: string): Promise<void> {
    const staffMember = await db.staff.findUnique({
      where: { id: coachId },
    });
    if (!staffMember) {
      throw new BadRequestException(`El entrenador con ID ${coachId} no existe`);
    }
    if (!staffMember.isActive) {
      throw new BadRequestException(`El entrenador con ID ${coachId} no está activo`);
    }
    
    // As per user rule: "Reutilizar las relaciones reales de Staff. Como mínimo: Staff existente, activo según dominio, elegible como entrenador y el pool definido"
    const isEligible = await db.teamSeasonStaff.findFirst({
      where: {
        staffId: coachId,
        teamSeasonCategory: {
          teamSeason: {
            teamId: teamId
          }
        },
        startedAt: { lte: new Date(matchDate) },
        OR: [
          { endedAt: null },
          { endedAt: { gte: new Date(matchDate) } }
        ]
      }
    });

    if (!isEligible) {
      throw new BadRequestException(`El entrenador con ID ${coachId} no es elegible para el equipo ${teamId} en la fecha del partido`);
    }
  }

  private calculateMatchResult(homeTeamId: string, awayTeamId: string, homeScore: number | null | undefined, awayScore: number | null | undefined, canTeamId: string): MatchResult {
    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
      return MatchResult.PENDING;
    }

    if (homeScore === awayScore) {
      return MatchResult.DRAW;
    }

    if (homeTeamId === canTeamId) {
      return homeScore > awayScore ? MatchResult.WIN : MatchResult.LOSS;
    } else {
      return awayScore > homeScore ? MatchResult.WIN : MatchResult.LOSS;
    }
  }

  async create(createMatchDto: CreateMatchDto, userId?: string) {
    const { startDate, endDate, locationId, homeTeamSeasonCategoryId, awayTeamSeasonCategoryId, homeTeamId, awayTeamId, homeScore, awayScore, ...matchData } = createMatchDto;

    const canTeamId = await this.validateMatchIntegrity(this.prisma, homeTeamId, awayTeamId, homeTeamSeasonCategoryId, awayTeamSeasonCategoryId);
    const calculatedResult = this.calculateMatchResult(homeTeamId, awayTeamId, homeScore, awayScore, canTeamId);
    
    if (matchData.homeCoachId) {
      await this.validateCoachEligibility(this.prisma, matchData.homeCoachId, homeTeamId, startDate);
    }
    if (matchData.awayCoachId) {
      await this.validateCoachEligibility(this.prisma, matchData.awayCoachId, awayTeamId, startDate);
    }

    const baseData: BaseEventCreateDto = {
      eventType: EventType.MATCH,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      locationId,
    };

    const result = await this.eventsService.executeEventCreation(baseData, userId, async (tx, eventId) => {
      return tx.match.create({
        data: {
          ...matchData,
          homeTeamId,
          awayTeamId,
          homeScore,
          awayScore,
          result: calculatedResult,
          eventId,
          homeTeamSeasonCategoryId: homeTeamSeasonCategoryId || null,
          awayTeamSeasonCategoryId: awayTeamSeasonCategoryId || null,
        },
        select: matchSelect,
      });
    });

    return {
      message: 'Partido programado exitosamente',
      data: result.specific,
    };
  }

  async findAll(paginationDto: MatchesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'startDate',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.MatchWhereInput = {};

    if (search) {
      where.OR = [
        {
          awayTeam: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          homeTeam: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          teamSeasonCategory: {
            teamSeason: {
              team: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
        {
          event: {
            location: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [matches, totalItems] = await Promise.all([
      this.prisma.match.findMany({
        where,
        take: per_page,
        skip,
        orderBy: sortField === 'startDate' ? { event: { startDate: orderBy } } : { [sortField]: orderBy },
        select: matchSelect,
      }),
      this.prisma.match.count({ where }),
    ]);

    return createPaginationResult(
      matches,
      totalItems,
      page,
      per_page,
      'Partidos obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: matchSelect,
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }
    return {
      message: 'Partido obtenido exitosamente',
      data: match,
    };
  }

  async update(id: string, updateMatchDto: UpdateMatchDto, userId?: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      select: { eventId: true }
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    const { startDate, endDate, locationId, homeTeamSeasonCategoryId, awayTeamSeasonCategoryId, homeTeamId, awayTeamId, homeScore, awayScore, ...matchData } = updateMatchDto;

    const baseData: BaseEventUpdateDto = {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(locationId !== undefined && { locationId }),
    };

    const result = await this.eventsService.executeEventUpdate(match.eventId, baseData, userId, async (tx) => {
      const currentMatch = await tx.match.findUnique({
        where: { id },
        include: { event: true, _count: { select: { callUps: true } } },
      });

      if (!currentMatch) {
        throw new NotFoundException('El partido no existe');
      }

      const callUpsCount = currentMatch._count.callUps;
      const isChangingStructuralFields = 
        (homeTeamId !== undefined && homeTeamId !== currentMatch.homeTeamId) ||
        (awayTeamId !== undefined && awayTeamId !== currentMatch.awayTeamId) ||
        (homeTeamSeasonCategoryId !== undefined && homeTeamSeasonCategoryId !== currentMatch.homeTeamSeasonCategoryId) ||
        (awayTeamSeasonCategoryId !== undefined && awayTeamSeasonCategoryId !== currentMatch.awayTeamSeasonCategoryId) ||
        (baseData.startDate !== undefined && new Date(baseData.startDate).getTime() !== currentMatch.event.startDate.getTime());

      MatchLifecyclePolicy.assertStructuralFieldsEditable(callUpsCount > 0, isChangingStructuralFields);

      const effectiveHomeTeamId = homeTeamId ?? currentMatch.homeTeamId;
      const effectiveAwayTeamId = awayTeamId ?? currentMatch.awayTeamId;
      
      const effectiveHomeCategoryId = homeTeamSeasonCategoryId !== undefined ? homeTeamSeasonCategoryId : currentMatch.homeTeamSeasonCategoryId;
      const effectiveAwayCategoryId = awayTeamSeasonCategoryId !== undefined ? awayTeamSeasonCategoryId : currentMatch.awayTeamSeasonCategoryId;
      
      const effectiveHomeScore = homeScore !== undefined ? homeScore : currentMatch.homeScore;
      const effectiveAwayScore = awayScore !== undefined ? awayScore : currentMatch.awayScore;

      const canTeamId = await this.validateMatchIntegrity(tx, effectiveHomeTeamId, effectiveAwayTeamId, effectiveHomeCategoryId, effectiveAwayCategoryId);
      const calculatedResult = this.calculateMatchResult(effectiveHomeTeamId, effectiveAwayTeamId, effectiveHomeScore, effectiveAwayScore, canTeamId);
      
      const effectiveDate = startDate ? new Date(startDate) : currentMatch.event.startDate;

      if (matchData.homeCoachId) {
        await this.validateCoachEligibility(tx, matchData.homeCoachId, effectiveHomeTeamId, effectiveDate.toISOString());
      }
      if (matchData.awayCoachId) {
        await this.validateCoachEligibility(tx, matchData.awayCoachId, effectiveAwayTeamId, effectiveDate.toISOString());
      }

      return tx.match.update({
        where: { id },
        data: {
          ...matchData,
          homeTeamId,
          awayTeamId,
          ...(homeScore !== undefined && { homeScore }),
          ...(awayScore !== undefined && { awayScore }),
          result: calculatedResult,
          ...(homeTeamSeasonCategoryId !== undefined && { homeTeamSeasonCategoryId }),
          ...(awayTeamSeasonCategoryId !== undefined && { awayTeamSeasonCategoryId }),
        },
        select: matchSelect,
      });
    });

    return {
      message: 'Partido actualizado exitosamente',
      data: result.specific,
    };
  }

  async remove(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { event: true },
    });
    if (!match) {
      throw new NotFoundException('El partido solicitado no fue encontrado');
    }

    MatchLifecyclePolicy.assertScheduled(match.event.status, 'eliminar');

    await this.eventsService.executeEventDeletion(match.eventId);

    return {
      message: 'Partido eliminado exitosamente',
      data: { id },
    };
  }

  // --- LIFECYCLE TRANSITIONS ---

  async completeMatch(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const matchPre = await tx.match.findUnique({
        where: { id },
        select: { eventId: true }
      });
      if (!matchPre) throw new NotFoundException('El partido no existe');
      
      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, matchPre.eventId);
      MatchLifecyclePolicy.assertValidTransition(lockedStatus, EventStatus.COMPLETED);

      const match = await tx.match.findUnique({ where: { id } });
      if (!match) throw new NotFoundException('El partido no existe');

      if (match.homeScore === null || match.awayScore === null) {
        throw new BadRequestException('Para completar un partido, tanto el score local como el visitante deben estar definidos.');
      }

      await tx.event.update({
        where: { id: match.eventId },
        data: { status: EventStatus.COMPLETED },
      });

      return { message: 'Partido completado exitosamente' };
    });
  }

  async cancelMatch(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const matchPre = await tx.match.findUnique({
        where: { id },
        select: { eventId: true }
      });
      if (!matchPre) throw new NotFoundException('El partido no existe');

      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, matchPre.eventId);
      MatchLifecyclePolicy.assertValidTransition(lockedStatus, EventStatus.CANCELLED);

      await tx.event.update({
        where: { id: matchPre.eventId },
        data: { status: EventStatus.CANCELLED },
      });

      return { message: 'Partido cancelado exitosamente' };
    });
  }

  async reopenMatch(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const matchPre = await tx.match.findUnique({
        where: { id },
        select: { eventId: true }
      });
      if (!matchPre) throw new NotFoundException('El partido no existe');

      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, matchPre.eventId);
      MatchLifecyclePolicy.assertValidTransition(lockedStatus, EventStatus.SCHEDULED);

      await tx.event.update({
        where: { id: matchPre.eventId },
        data: { status: EventStatus.SCHEDULED },
      });

      return { message: 'Partido reabierto exitosamente' };
    });
  }

  async restoreMatch(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const matchPre = await tx.match.findUnique({
        where: { id },
        select: { eventId: true }
      });
      if (!matchPre) throw new NotFoundException('El partido no existe');

      const lockedStatus = await MatchLifecyclePolicy.lockEventForMatchLifecycle(tx, matchPre.eventId);
      MatchLifecyclePolicy.assertValidTransition(lockedStatus, EventStatus.SCHEDULED);

      await tx.event.update({
        where: { id: matchPre.eventId },
        data: { status: EventStatus.SCHEDULED },
      });

      return { message: 'Partido restaurado exitosamente' };
    });
  }

  async findPublicFixture(query?: FindPublicFixtureDto) {
    const commonWhere = {
      OR: [
        {
          teamSeasonCategory: {
            status: TeamSeasonCategoryStatus.ACTIVE,
            teamSeason: {
              status: StatusTeamSeason.ACTIVE,
              season: {
                status: SeasonStatus.ACTIVE,
              },
            },
          },
        },
        {
          homeTeamSeasonCategory: {
            status: TeamSeasonCategoryStatus.ACTIVE,
            teamSeason: {
              status: StatusTeamSeason.ACTIVE,
              season: {
                status: SeasonStatus.ACTIVE,
              },
            },
          },
        },
        {
          awayTeamSeasonCategory: {
            status: TeamSeasonCategoryStatus.ACTIVE,
            teamSeason: {
              status: StatusTeamSeason.ACTIVE,
              season: {
                status: SeasonStatus.ACTIVE,
              },
            },
          },
        },
        {
          homeTeam: {
            club: {
              isExternal: false,
            },
          },
        },
        {
          awayTeam: {
            club: {
              isExternal: false,
            },
          },
        },
      ]
    };

    const publicSelect = {
      id: true,
      homeScore: true,
      awayScore: true,
      result: true,
      event: {
        select: {
          startDate: true,
          status: true,
          location: {
            select: { name: true },
          },
        },
      },
      homeTeam: {
        select: {
          name: true,
          imageUrl: true,
        }
      },
      awayTeam: {
        select: {
          name: true,
          imageUrl: true,
        }
      },
      teamSeasonCategory: {
        select: {
          category: { select: { name: true } },
          teamSeason: {
            select: {
              team: { select: { club: { select: { discipline: { select: { name: true } } } } } },
            },
          },
        },
      },
      homeTeamSeasonCategory: {
        select: {
          category: { select: { name: true } },
          teamSeason: {
            select: {
              team: { select: { club: { select: { discipline: { select: { name: true } } } } } },
            },
          },
        },
      },
      awayTeamSeasonCategory: {
        select: {
          category: { select: { name: true } },
          teamSeason: {
            select: {
              team: { select: { club: { select: { discipline: { select: { name: true } } } } } },
            },
          },
        },
      },
    };

    const formatMatch = (match: any) => {
      const activeCategoryForDiscipline = match.homeTeamSeasonCategory || match.awayTeamSeasonCategory || match.teamSeasonCategory;
      return {
      id: match.id,
      homeCategoryName: match.homeTeamSeasonCategory?.category?.name || match.teamSeasonCategory?.category?.name || null,
      awayCategoryName: match.awayTeamSeasonCategory?.category?.name || match.teamSeasonCategory?.category?.name || null,
      locationName: match.event?.location?.name ?? null,
      date: match.event?.startDate?.toISOString() || new Date().toISOString(),
      homeTeam: {
        name: match.homeTeam?.name || 'Local',
        imageUrl: match.homeTeam?.imageUrl || null,
      },
      awayTeam: {
        name: match.awayTeam?.name || 'Visitante',
        imageUrl: match.awayTeam?.imageUrl || null,
      },
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: (match.event?.status === EventStatus.COMPLETED || (match.homeScore !== null && match.awayScore !== null)) ? 'PLAYED' : 'PENDING',
      discipline: activeCategoryForDiscipline?.teamSeason?.team?.club?.discipline?.name || 'Deporte',
    };
    };
    if ((query?.from && !query?.to) || (!query?.from && query?.to)) {
      throw new BadRequestException('Ambos parámetros "from" y "to" deben ser proveídos juntos.');
    }

    if (query?.from && query?.to) {
      const fromDate = new Date(query.from);
      const toDate = new Date(query.to);

      if (fromDate >= toDate) {
        throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin');
      }

      const diffInDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 3600 * 24);
      if (diffInDays > 93) {
        throw new BadRequestException('El rango máximo de consulta es de 93 días');
      }

      const rangeMatches = await this.prisma.match.findMany({
        where: {
          ...commonWhere,
          event: {
            startDate: {
              gte: fromDate,
              lt: toDate,
            },
            status: { not: EventStatus.CANCELLED },
          },
        },
        orderBy: { event: { startDate: 'asc' } },
        select: publicSelect,
      });

      return {
        message: 'Fixture público obtenido exitosamente',
        data: rangeMatches.map(formatMatch),
      };
    }

    const [recentMatches, upcomingMatches] = await Promise.all([
      // Resultados recientes
      this.prisma.match.findMany({
        where: {
          ...commonWhere,
          event: {
            startDate: { lt: new Date() },
            status: { not: EventStatus.CANCELLED },
          },
        },
        orderBy: { event: { startDate: 'desc' } },
        take: 6,
        select: publicSelect,
      }),
      // Próximos partidos
      this.prisma.match.findMany({
        where: {
          ...commonWhere,
          event: {
            startDate: { gte: new Date() },
            status: { not: EventStatus.CANCELLED },
          },
        },
        orderBy: { event: { startDate: 'asc' } },
        take: 6,
        select: publicSelect,
      }),
    ]);

    const data = [
      ...recentMatches.map(formatMatch),
      ...upcomingMatches.map(formatMatch),
    ];

    return {
      message: 'Fixture público obtenido exitosamente',
      data,
    };
  }

  async getTeamContext(query: { teamSeasonCategoryId: string; matchDate: string }) {
    const { teamSeasonCategoryId, matchDate } = query;

    const tsc = await this.prisma.teamSeasonCategory.findUnique({
      where: { id: teamSeasonCategoryId },
      include: {
        teamSeason: {
          include: {
            team: {
              include: {
                club: true,
              },
            },
          },
        },
        teamSeasonStaffs: {
          where: {
            startedAt: { lte: new Date(matchDate) },
            OR: [
              { endedAt: null },
              { endedAt: { gte: new Date(matchDate) } },
            ],
          },
          include: {
            staff: {
              include: {
                person: true,
              },
            },
          },
        },
      },
    });

    if (!tsc) {
      throw new NotFoundException('TeamSeasonCategory not found');
    }

    const isExternal = tsc.teamSeason.team.club?.isExternal || false;

    const eligibleCoaches = tsc.teamSeasonStaffs
      .filter(tss => tss.staff?.isActive)
      .map(tss => ({
        id: tss.staff.id,
        name: `${tss.staff.person.name} ${tss.staff.person.lastName}`,
        role: tss.role,
        isPrimary: tss.isPrimary,
      }));

    let defaultCoach = null;
    if (eligibleCoaches.length > 0) {
      defaultCoach = eligibleCoaches.find(c => c.role === 'HEAD_COACH' && c.isPrimary) ||
                     eligibleCoaches.find(c => c.role === 'HEAD_COACH') ||
                     eligibleCoaches.find(c => c.isPrimary) ||
                     null;
    }

    return {
      message: 'Team context fetched successfully',
      data: {
        teamSeasonCategoryId,
        isExternal,
        defaultCoach: defaultCoach ? { id: defaultCoach.id, name: defaultCoach.name } : null,
        eligibleCoaches: eligibleCoaches.map(c => ({ id: c.id, name: c.name })),
      },
    };
  }
}
