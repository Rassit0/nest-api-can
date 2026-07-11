import { Module } from '@nestjs/common';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { PrismaService } from 'src/prisma.service';
import { LateFeeRepository } from './repositories/late-fee.repository';

@Module({
  providers: [MembershipLateFeeService, PrismaService, LateFeeRepository],
  exports: [MembershipLateFeeService],
})
export class MembershipLateFeeModule {}
