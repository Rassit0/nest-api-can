import { Module } from '@nestjs/common';
import { TeamSeasonStaffService } from './team-season-staff.service';
import { TeamSeasonStaffController } from './team-season-staff.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TeamSeasonStaffController],
  providers: [TeamSeasonStaffService, PrismaService],
})
export class TeamSeasonStaffModule {}
