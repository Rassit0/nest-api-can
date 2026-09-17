import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { StorageModule } from '../storage/storage.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [StorageModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PrismaService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
