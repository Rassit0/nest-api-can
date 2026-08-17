import { Module } from '@nestjs/common';
import { MembershipRegularizationService } from './services/membership-regularization.service';
import { MembershipChargesService } from './membership-charges.service';
import { MembershipChargesController } from './membership-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { MembershipPreviewService } from './services/membership-preview.service';
import { MembershipGenerationService } from './services/membership-generation.service';
import { MembershipRepository } from './repositories/membership.repository';
import { MembershipChargeRepository } from './repositories/membership-charge.repository';
import { MembershipChargesCron } from './membership-charges.cron';
import { MembershipChargeRecalculationService } from './services/membership-recalculation.service';
import { MembershipManualChargeService } from './services/membership-manual-charge.service';
import { MembershipAdvanceChargeService } from './services/membership-advance-charge.service';
import { MembershipRecalibrationDateCalculator } from './domain/membership-recalibration-date.calculator';

@Module({
  controllers: [MembershipChargesController],
  providers: [
    MembershipChargesService,
    MembershipRegularizationService,
    PrismaService,
    MembershipPreviewService,
    MembershipGenerationService,
    MembershipRepository,
    MembershipChargeRepository,
    MembershipChargesCron,
    MembershipChargeRecalculationService,
    MembershipManualChargeService,
    MembershipAdvanceChargeService,
    MembershipRecalibrationDateCalculator,
  ],
  exports: [MembershipChargesService],
})
export class MembershipChargesModule {}

