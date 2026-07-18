import { Module } from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { MembershipChargesController } from './membership-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { MembershipPreviewService } from './services/membership-preview.service';
import { MembershipGenerationService } from './services/membership-generation.service';
import { MembershipRepository } from './repositories/membership.repository';
import { MembershipChargeRepository } from './repositories/membership-charge.repository';
import { MembershipChargesCron } from './membership-charges.cron';

@Module({
  controllers: [MembershipChargesController],
  providers: [
    MembershipChargesService, 
    PrismaService, 
    MembershipPreviewService, 
    MembershipGenerationService,
    MembershipRepository,
    MembershipChargeRepository,
    MembershipChargesCron
  ],
  exports: [MembershipChargesService],
})
export class MembershipChargesModule {}
