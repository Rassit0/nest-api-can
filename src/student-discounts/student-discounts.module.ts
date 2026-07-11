import { Module } from '@nestjs/common';
import { StudentDiscountsService } from './student-discounts.service';
import { StudentDiscountsController } from './student-discounts.controller';
import { PrismaService } from 'src/prisma.service';

import { StudentChargesModule } from 'src/student-charges/student-charges.module';

@Module({
  imports: [StudentChargesModule],
  controllers: [StudentDiscountsController],
  providers: [StudentDiscountsService, PrismaService],
})
export class StudentDiscountsModule {}
