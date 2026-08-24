import { Module } from '@nestjs/common';
import { StudentRegularizationService } from './services/student-regularization.service';
import { StudentChargesService } from './student-charges.service';
import { StudentChargesController } from './student-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentEnrollmentService } from './services/student-enrollment.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';
import { StudentManualChargeService } from './services/student-manual-charge.service';
import { StudentAdvanceChargeService } from './services/student-advance-charge.service';
import { StudentCycleManagerService } from './services/student-cycle-manager.service';
import { StudentReactivationService } from './services/student-reactivation.service';

@Module({
  controllers: [StudentChargesController],
  providers: [
    StudentChargesService,
    StudentRegularizationService,
    StudentEnrollmentService,
    PrismaService,
    StudentPreviewService,
    StudentMembershipRepository,
    StudentChargeRepository,
    StudentManualChargeService,
    StudentAdvanceChargeService,
    StudentCycleManagerService,
    StudentReactivationService,
  ],
  exports: [StudentChargesService,
    StudentRegularizationService, StudentEnrollmentService, StudentCycleManagerService],
})
export class StudentChargesModule {}
