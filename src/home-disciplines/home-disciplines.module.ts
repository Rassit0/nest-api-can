import { Module } from '@nestjs/common';
import { HomeDisciplinesService } from './home-disciplines.service';
import { HomeDisciplinesController } from './home-disciplines.controller';
import { PrismaService } from '../prisma.service';

import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [HomeDisciplinesController],
  providers: [HomeDisciplinesService, PrismaService],
  exports: [HomeDisciplinesService],
})
export class HomeDisciplinesModule {}
