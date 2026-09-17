import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { InstitutionsModule } from '../institutions/institutions.module';
import { TeamSeasonModule } from '../team-season/team-season.module';
import { CourseSeasonsModule } from '../course-seasons/course-seasons.module';
import { MatchesModule } from '../matches/matches.module';
import { NewsModule } from '../news/news.module';
import { HeroBannersModule } from '../hero-banners/hero-banners.module';
import { HomeDisciplinesModule } from '../home-disciplines/home-disciplines.module';

import { NewsCategoriesModule } from '../news-categories/news-categories.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    InstitutionsModule,
    TeamSeasonModule,
    CourseSeasonsModule,
    MatchesModule,
    NewsModule,
    HeroBannersModule,
    HomeDisciplinesModule,
    NewsCategoriesModule,
    PromotionsModule
  ],
  controllers: [PublicController],
})
export class PublicModule {}
