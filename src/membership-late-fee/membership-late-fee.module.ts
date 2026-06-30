import { Module } from '@nestjs/common';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [MembershipLateFeeService, PrismaService],
})
export class MembershipLateFeeModule {}
