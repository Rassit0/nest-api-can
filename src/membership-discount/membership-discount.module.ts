import { Module } from '@nestjs/common';
import { MembershipDiscountService } from './membership-discount.service';
import { MembershipDiscountController } from './membership-discount.controller';
import { PrismaService } from 'src/prisma.service';

import { MembershipChargesModule } from 'src/membership-charges/membership-charges.module';

@Module({
  imports: [MembershipChargesModule],
  controllers: [MembershipDiscountController],
  providers: [MembershipDiscountService, PrismaService],
})
export class MembershipDiscountModule {}
