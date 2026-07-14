import { Module } from '@nestjs/common';
import { StudentMembershipsService } from './student-memberships.service';
import { StudentMembershipsController } from './student-memberships.controller';
import { PrismaService } from 'src/prisma.service';

import { StudentChargesModule } from 'src/student-charges/student-charges.module';
import { StudentMembershipsCron } from './student-memberships.cron';

@Module({
  imports: [StudentChargesModule],
  controllers: [StudentMembershipsController],
  providers: [StudentMembershipsService, PrismaService, StudentMembershipsCron],
})
export class StudentMembershipsModule {}
