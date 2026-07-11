import { Module } from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { MembershipChargesController } from './membership-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { MembershipPreviewService } from './services/membership-preview.service';
import { MembershipGenerationService } from './services/membership-generation.service';
import { MembershipRepository } from './repositories/membership.repository';
import { MembershipChargeRepository } from './repositories/membership-charge.repository';

@Module({
  controllers: [MembershipChargesController],
  providers: [
    MembershipChargesService, 
    PrismaService, 
    MembershipPreviewService, 
    MembershipGenerationService,
    MembershipRepository,
    MembershipChargeRepository
  ],
  exports: [MembershipChargesService],
})
export class MembershipChargesModule {}
