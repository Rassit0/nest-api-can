import { Module } from '@nestjs/common';
import { StudentChargesService } from './student-charges.service';
import { StudentLateFeeService } from './student-late-fee.service';
import { StudentChargesController } from './student-charges.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [StudentChargesController],
  providers: [StudentChargesService, StudentLateFeeService, PrismaService],
})
export class StudentChargesModule {}
