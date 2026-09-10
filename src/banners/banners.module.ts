import { Module } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { PrismaService } from '../prisma.service';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [BannersController],
  providers: [BannersService, PrismaService],
  exports: [BannersService],
})
export class BannersModule {}
