import { Module } from '@nestjs/common';
import { SessionIncidentsService } from './session-incidents.service';
import { SessionIncidentsController } from './session-incidents.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [SessionIncidentsController],
  providers: [SessionIncidentsService, PrismaService],
})
export class SessionIncidentsModule {}
