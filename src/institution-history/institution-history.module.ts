import { Module } from '@nestjs/common';
import { InstitutionHistoryController } from './institution-history.controller';
import { InstitutionHistoryService } from './institution-history.service';
import { PrismaService } from '../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { PublicInstitutionHistoryController } from './public-institution-history.controller';

@Module({
  imports: [StorageModule],
  controllers: [InstitutionHistoryController, PublicInstitutionHistoryController],
  providers: [InstitutionHistoryService, PrismaService],
})
export class InstitutionHistoryModule {}
