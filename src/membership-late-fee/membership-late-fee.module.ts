import { Module } from '@nestjs/common';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { PrismaService } from 'src/prisma.service';
import { LateFeeRepository } from './repositories/late-fee.repository';
import { MembershipLateFeeCron } from './membership-late-fee.cron';

@Module({
  providers: [MembershipLateFeeService, PrismaService, LateFeeRepository, MembershipLateFeeCron],
  exports: [MembershipLateFeeService],
})
export class MembershipLateFeeModule {}
