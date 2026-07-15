import { Module } from '@nestjs/common';
import { StudentChargesService } from './student-charges.service';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentChargesController } from './student-charges.controller';
import { PrismaService } from 'src/prisma.service';
import { StudentPreviewService } from './services/student-preview.service';
import { StudentGenerationService } from './services/student-generation.service';
import { StudentMembershipRepository } from './repositories/student-membership.repository';
import { StudentChargeRepository } from './repositories/student-charge.repository';

@Module({
  controllers: [StudentChargesController],
  providers: [
    StudentChargesService,
    StudentLateFeeService,
    PrismaService,
    StudentPreviewService,
    StudentGenerationService,
    StudentMembershipRepository,
    StudentChargeRepository
  ],
  exports: [StudentChargesService, StudentLateFeeService],
})
export class StudentChargesModule {}

