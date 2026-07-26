import { Module } from '@nestjs/common';
import { StudentChargesService } from './student-charges.service';
import { StudentChargesController } from './student-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentGenerationService } from './services/student-generation.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';
import { StudentChargesCron } from './student-charges.cron';
import { StudentChargeRecalculationService } from './services/student-recalculation.service';
import { StudentManualChargeService } from './services/student-manual-charge.service';
import { StudentAdvanceChargeService } from './services/student-advance-charge.service';
import { StudentRecalibrationDateCalculator } from './domain/student-recalibration-date.calculator';

@Module({
  controllers: [StudentChargesController],
  providers: [
    StudentChargesService,
    PrismaService,
    StudentPreviewService,
    StudentGenerationService,
    StudentMembershipRepository,
    StudentChargeRepository,
    StudentChargesCron,
    StudentChargeRecalculationService,
    StudentManualChargeService,
    StudentAdvanceChargeService,
    StudentRecalibrationDateCalculator,
  ],
  exports: [StudentChargesService],
})
export class StudentChargesModule {}
