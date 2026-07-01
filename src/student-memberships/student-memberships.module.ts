import { Module } from '@nestjs/common';
import { StudentMembershipsService } from './student-memberships.service';
import { StudentMembershipsController } from './student-memberships.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [StudentMembershipsController],
  providers: [StudentMembershipsService, PrismaService],
})
export class StudentMembershipsModule {}
