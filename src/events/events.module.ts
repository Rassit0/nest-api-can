import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { AvailabilityEngine } from './engines/availability.engine';
import { PrismaService } from 'src/prisma.service';
import { EventQueriesService } from './event-queries.service';
import { EventRecurrenceService } from './event-recurrence.service';
import { EventMaterializationService } from './event-materialization.service';
import { EventSeriesService } from './event-series.service';
import { EventMaterializationJob } from './jobs/event-materialization.job';

@Module({
  controllers: [EventsController],
  providers: [
    EventsService,
    EventQueriesService,
    EventRecurrenceService,
    EventMaterializationService,
    EventSeriesService,
    EventMaterializationJob,
    AvailabilityEngine,
    PrismaService,
  ],
  exports: [EventsService, EventQueriesService, AvailabilityEngine, EventSeriesService, EventMaterializationService],
})
export class EventsModule {}
