import { Module } from '@nestjs/common';
import { StudentChargesService } from './student-charges.service';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentChargesController } from './student-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentGenerationService } from './services/student-generation.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';
import { StudentChargesCron } from './student-charges.cron';
import { StudentLateFeeCron } from './student-late-fee.cron';

@Module({
  controllers: [StudentChargesController],
  providers: [
    StudentChargesService,
    StudentLateFeeService,
    PrismaService,
    StudentPreviewService,
    StudentGenerationService,
    StudentMembershipRepository,
    StudentChargeRepository,
    StudentChargesCron,
    StudentLateFeeCron
  ],
  exports: [StudentChargesService, StudentLateFeeService],
})
export class StudentChargesModule {}

