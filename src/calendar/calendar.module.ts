import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarQueriesService } from './calendar-queries.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, CalendarQueriesService, PrismaService],
  exports: [CalendarService],
})
export class CalendarModule {}
