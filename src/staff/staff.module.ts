import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffAccessService } from './staff-access.service';
import { PrismaService } from 'src/prisma.service';

import { SessionsModule } from 'src/sessions/sessions.module';
import { EventsModule } from 'src/events/events.module';

@Module({
  imports: [SessionsModule, EventsModule],
  controllers: [StaffController],
  providers: [StaffService, StaffAccessService, PrismaService],
  exports: [StaffService, StaffAccessService],
})
export class StaffModule {}
