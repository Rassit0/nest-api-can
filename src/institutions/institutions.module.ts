import { Module } from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService, PrismaService],
})
export class InstitutionsModule {}
