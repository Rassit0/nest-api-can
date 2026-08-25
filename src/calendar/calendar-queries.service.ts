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
      teamSeasonCategoryId,
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
    if (institutionId || teamSeasonCategoryId || courseSeasonId) {
      where.OR = [
        {
          generalEvent: {
            ...(institutionId && { institutionId }),
            ...(teamSeasonCategoryId && { teamSeasonCategoryId }),
            ...(courseSeasonId && { courseSeasonId }),
          },
        },
        {
          session: {
            OR: [
              { sessionTeams: { some: { teamSeasonCategoryId } } },
              { sessionCourses: { some: { courseSeasonShift: { courseSeasonId: courseSeasonId } } } }
            ]
          }
        },
        {
          match: {
            ...(teamSeasonCategoryId && { teamSeasonCategoryId })
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
                teamSeasonCategory: {
                  select: {
                    id: true,
                    teamSeason: { select: { id: true, team: { select: { name: true } } } },
                    category: { select: { name: true } }
                  }
                }
              }
            },
            sessionCourses: {
              select: {
                courseSeasonShift: {
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
            }
          }
        },
        
        match: {
          select: {
            opponentName: true,
            type: true,
            result: true,
            teamSeasonCategory: {
              select: {
                id: true,
                teamSeason: { select: { id: true, team: { select: { name: true } } } },
                category: { select: { name: true } }
              }
            }
          }
        },
        
        generalEvent: {
          select: {
            institutionId: true,
            teamSeasonCategoryId: true,
            courseSeasonId: true,
          }
        }
      },
      orderBy: { startDate: 'asc' },
    });
  }
}
