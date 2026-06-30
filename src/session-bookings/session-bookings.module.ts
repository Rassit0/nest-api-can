import { Module } from '@nestjs/common';
import { SessionBookingsService } from './session-bookings.service';
import { SessionBookingsController } from './session-bookings.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SessionBookingsController],
  providers: [SessionBookingsService, PrismaService],
})
export class SessionBookingsModule {}
