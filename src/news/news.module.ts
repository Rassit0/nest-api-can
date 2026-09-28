import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { PrismaService } from '../prisma.service';

import { StorageModule } from '../storage/storage.module';
import { NewsAssetService } from './news-asset.service';
import { NewsAssetCleanupService } from './news-asset-cleanup.service';

@Module({
  imports: [StorageModule],
  controllers: [NewsController],
  providers: [NewsService, PrismaService, NewsAssetService, NewsAssetCleanupService],
  exports: [NewsService, NewsAssetService],
})
export class NewsModule {}
