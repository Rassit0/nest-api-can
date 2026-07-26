import { Module } from '@nestjs/common';
import { TransactionReportService } from './transaction-report.service';
import { TransactionReportController } from './transaction-report.controller';
import { PrinterModule } from 'src/printer/printer.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [PrinterModule],
  controllers: [TransactionReportController],
  providers: [TransactionReportService, PrismaService],
})
export class TransactionReportModule {}
