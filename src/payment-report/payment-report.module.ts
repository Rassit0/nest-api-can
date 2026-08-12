import { Module } from '@nestjs/common';
import { PaymentReportService } from './payment-report.service';
import { PaymentReportController } from './payment-report.controller';
import { PrinterModule } from 'src/printer/printer.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [PrinterModule],
  controllers: [PaymentReportController],
  providers: [PaymentReportService, PrismaService],
})
export class PaymentReportModule {}
