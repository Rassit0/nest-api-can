import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { AvailabilityEngine } from './engines/availability.engine';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [EventsController],
  providers: [EventsService, AvailabilityEngine, PrismaService],
  exports: [EventsService, AvailabilityEngine],
})
export class EventsModule {}
