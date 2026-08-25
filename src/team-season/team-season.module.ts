import { Module } from '@nestjs/common';
import { TeamSeasonService } from './team-season.service';
import { TeamSeasonsController } from './team-season.controller';
import { TeamSeasonCategoryService } from './team-season-category.service';
import { TeamSeasonCategoryController } from './team-season-category.controller';
import { PrismaService } from 'src/prisma.service';
import { NestjsFormDataModule } from 'nestjs-form-data';

@Module({
  imports: [NestjsFormDataModule.config({ isGlobal: true })],
  controllers: [TeamSeasonsController, TeamSeasonCategoryController],
  providers: [TeamSeasonService, TeamSeasonCategoryService, PrismaService],
})
export class TeamSeasonModule {}
