import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { PrismaService } from '../prisma.service';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [NewsController],
  providers: [NewsService, PrismaService],
  exports: [NewsService],
})
export class NewsModule {}
