import { Module } from '@nestjs/common';
import { TeamSeasonsService } from './team-seasons.service';
import { TeamSeasonsController } from './team-seasons.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TeamSeasonsController],
  providers: [TeamSeasonsService, PrismaService],
})
export class TeamSeasonsModule {}
