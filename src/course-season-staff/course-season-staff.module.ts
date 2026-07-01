import { Module } from '@nestjs/common';
import { CourseSeasonStaffService } from './course-season-staff.service';
import { CourseSeasonStaffController } from './course-season-staff.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CourseSeasonStaffController],
  providers: [CourseSeasonStaffService, PrismaService],
})
export class CourseSeasonStaffModule {}
