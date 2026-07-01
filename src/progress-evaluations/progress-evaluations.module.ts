import { Module } from '@nestjs/common';
import { ProgressEvaluationsService } from './progress-evaluations.service';
import { ProgressEvaluationsController } from './progress-evaluations.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ProgressEvaluationsController],
  providers: [ProgressEvaluationsService, PrismaService],
})
export class ProgressEvaluationsModule {}
