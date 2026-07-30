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
      courseSeasonId,
    } = filter;

    return this.prisma.event.findMany({
      where: {
        startDate: { gte: new Date(startDate) },
        endDate: { lte: new Date(endDate) },
        ...(locationId && { locationId }),
        ...(eventType && { eventType }),
        generalEvent: (institutionId || teamSeasonId || courseSeasonId)
          ? {
              ...(institutionId && { institutionId }),
              ...(teamSeasonId && { teamSeasonId }),
              ...(courseSeasonId && { courseSeasonId }),
            }
          : undefined,
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
