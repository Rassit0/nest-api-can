import { Module } from '@nestjs/common';
import { CourseSeasonsService } from './course-seasons.service';
import { CourseSeasonsController } from './course-seasons.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CourseSeasonsController],
  providers: [CourseSeasonsService, PrismaService],
})
export class CourseSeasonsModule {}
