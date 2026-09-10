import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { InstitutionsModule } from '../institutions/institutions.module';
import { TeamSeasonModule } from '../team-season/team-season.module';
import { CourseSeasonsModule } from '../course-seasons/course-seasons.module';
import { MatchesModule } from '../matches/matches.module';
import { NewsModule } from '../news/news.module';
import { BannersModule } from '../banners/banners.module';

@Module({
  imports: [
    InstitutionsModule,
    TeamSeasonModule,
    CourseSeasonsModule,
    MatchesModule,
    NewsModule,
    BannersModule
  ],
  controllers: [PublicController],
})
export class PublicModule {}
