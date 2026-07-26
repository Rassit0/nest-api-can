import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentLateFeeCron } from './student-late-fee.cron';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentLateFeeRepository } from './repositories/student-late-fee.repository';

@Module({
  providers: [
    PrismaService,
    StudentLateFeeCron,
    StudentLateFeeService,
    StudentLateFeeRepository,
  ],
  exports: [StudentLateFeeService],
})
export class StudentLateFeeModule {}
