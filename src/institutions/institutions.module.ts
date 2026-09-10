import { Module } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService, PrismaService],
  exports: [InstitutionsService],
})
export class InstitutionsModule {}
