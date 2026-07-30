import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CalendarFilterDto } from './dto/calendar-filter.dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class CalendarQueriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findCalendarEvents(filter: CalendarFilterDto) {
    const {
      startDate,
      endDate,
      eventTypes,
      locationId,
      institutionId,
      teamSeasonId,
      courseSeasonId,
    } = filter;

    // TODO: A futuro se pueden agregar filtros más sofisticados aquí.
    const where: Prisma.EventWhereInput = {
      startDate: { gte: new Date(startDate) },
      endDate: { lte: new Date(endDate) },
      ...(locationId && { locationId }),
      ...(eventTypes && eventTypes.length > 0 && { eventType: { in: eventTypes } }),
    };

    // Si pasaron filtros específicos de dominios (team, institution, course),
    // aplicamos filtro "OR" cruzando las entidades relacionadas que puedan tenerlos.
    if (institutionId || teamSeasonId || courseSeasonId) {
      where.OR = [
        {
          generalEvent: {
            ...(institutionId && { institutionId }),
            ...(teamSeasonId && { teamSeasonId }),
            ...(courseSeasonId && { courseSeasonId }),
          },
        },
        {
          session: {
            OR: [
              { sessionTeams: { some: { teamSeasonId: teamSeasonId } } },
              { sessionCourses: { some: { courseSeasonId: courseSeasonId } } }
            ]
          }
        },
        {
          match: {
            ...(teamSeasonId && { teamSeasonId })
          }
        }
      ];
    }

    return this.prisma.event.findMany({
      where,
      select: {
        id: true,
        title: true,
        eventType: true,
        startDate: true,
        endDate: true,
        status: true,
        color: true,
        location: {
          select: {
            id: true,
            name: true,
          }
        },
        eventSeriesId: true,
        
        session: {
          select: {
            durationMin: true,
            sessionTeams: {
              select: {
                teamSeason: {
                  select: {
                    id: true,
                    team: { select: { name: true } }
                  }
                }
              }
            },
            sessionCourses: {
              select: {
                courseSeason: {
                  select: {
                    id: true,
                    course: { select: { name: true } }
                  }
                }
              }
            }
          }
        },
        
        match: {
          select: {
            opponentName: true,
            type: true,
            result: true,
            teamSeason: {
              select: {
                id: true,
                team: { select: { name: true } }
              }
            }
          }
        },
        
        generalEvent: {
          select: {
            institutionId: true,
            teamSeasonId: true,
            courseSeasonId: true,
          }
        }
      },
      orderBy: { startDate: 'asc' },
    });
  }
}
