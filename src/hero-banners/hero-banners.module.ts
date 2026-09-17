import { Module } from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { HeroBannersController } from './hero-banners.controller';
import { PrismaService } from '../prisma.service';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [HeroBannersController],
  providers: [HeroBannersService, PrismaService],
  exports: [HeroBannersService],
})
export class HeroBannersModule {}
