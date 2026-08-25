import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { EventFilterDto } from './dto/event-filter.dto';

@Injectable()
export class EventQueriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: EventFilterDto) {
    const {
      startDate,
      endDate,
      locationId,
      eventType,
      institutionId,
      teamSeasonId,
      teamSeasonCategoryId,
      courseSeasonId,
    } = filter;

    let categoryIds: string[] | undefined;

    if (teamSeasonId) {
      const categories = await this.prisma.teamSeasonCategory.findMany({
        where: { teamSeasonId },
        select: { id: true },
      });
      categoryIds = categories.map((c) => c.id);
    }

    if (teamSeasonCategoryId) {
      categoryIds = [teamSeasonCategoryId];
    }

    return this.prisma.event.findMany({
      where: {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
        ...(locationId && { locationId }),
        ...(eventType && { eventType }),
        ...(categoryIds && {
          OR: [
            { generalEvent: { teamSeasonCategoryId: { in: categoryIds } } },
            { match: { teamSeasonCategoryId: { in: categoryIds } } },
            { session: { sessionTeams: { some: { teamSeasonCategoryId: { in: categoryIds } } } } }
          ]
        }),
        ...(!categoryIds && (institutionId || courseSeasonId) && {
          generalEvent: {
            ...(institutionId && { institutionId }),
            ...(courseSeasonId && { courseSeasonId }),
          },
        }),
      },
      include: {
        location: true,
        generalEvent: true,
        match: true,
        session: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOneGeneralEvent(id: string) {
    return this.prisma.generalEvent.findUnique({
      where: { id },
      include: {
        event: {
          include: {
            location: true,
            createdBy: { select: { id: true, email: true } },
            updatedBy: { select: { id: true, email: true } },
          },
        },
      },
    });
  }

  async findOneEvent(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        location: true,
        generalEvent: true,
        match: true,
        session: true,
      },
    });
  }
}
