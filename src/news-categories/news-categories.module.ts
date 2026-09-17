import { Module } from '@nestjs/common';
import { NewsCategoriesController } from './news-categories.controller';
import { NewsCategoriesService } from './news-categories.service';

@Module({
  controllers: [NewsCategoriesController],
  providers: [NewsCategoriesService],
  exports: [NewsCategoriesService],
})
export class NewsCategoriesModule {}
