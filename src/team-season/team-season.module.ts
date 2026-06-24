import { Module } from '@nestjs/common';
import { TeamSeasonService } from './team-season.service';
import { TeamSeasonsController } from './team-season.controller';
import { PrismaService } from 'src/prisma.service';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [NestjsFormDataModule.config({ isGlobal: true })],
  controllers: [TeamSeasonsController],
  providers: [TeamSeasonService, PrismaService],
})
export class TeamSeasonModule { }
