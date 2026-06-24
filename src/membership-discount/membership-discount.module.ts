import { Module } from '@nestjs/common';
import { MembershipDiscountService } from './membership-discount.service';
import { MembershipDiscountController } from './membership-discount.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [MembershipDiscountController],
  providers: [MembershipDiscountService, PrismaService],
})
export class MembershipDiscountModule {}
