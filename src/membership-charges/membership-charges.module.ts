import { Module } from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { MembershipChargesController } from './membership-charges.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [MembershipChargesController],
  providers: [MembershipChargesService, PrismaService],
  exports: [MembershipChargesService],
})
export class MembershipChargesModule {}
