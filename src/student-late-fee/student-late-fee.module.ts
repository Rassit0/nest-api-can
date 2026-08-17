import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentLateFeeRepository } from './repositories/student-late-fee.repository';
import { StudentLateFeeController } from './student-late-fee.controller';

@Module({
  controllers: [StudentLateFeeController],
  providers: [
    PrismaService,
    StudentLateFeeService,
    StudentLateFeeRepository,
  ],
  exports: [StudentLateFeeService],
})
export class StudentLateFeeModule {}
