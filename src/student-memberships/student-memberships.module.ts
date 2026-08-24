import { Module } from '@nestjs/common';
import { StudentMembershipsService } from './student-memberships.service';
import { StudentMembershipsController } from './student-memberships.controller';
import { PrismaService } from 'src/prisma.service';

import { StudentChargesModule } from 'src/student-charges/student-charges.module';
import { ChargesModule } from 'src/charges/charges.module';
import { StudentMembershipsCron } from './student-memberships.cron';

@Module({
  imports: [StudentChargesModule, ChargesModule],
  controllers: [StudentMembershipsController],
  providers: [StudentMembershipsService, PrismaService, StudentMembershipsCron],
})
export class StudentMembershipsModule {}
