import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { AccountingReportModule } from './accounting/accounting-report.module';
import { ReportCoreModule } from './core/report-core.module';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PaymentsMatrixPdfService } from './payments-matrix-pdf.service';
import { MonthlyCashflowService } from './monthly-cashflow.service';
import { MonthlyCashflowExcelService } from './monthly-cashflow-excel.service';
import { PrinterModule } from '../printer/printer.module';

@Module({
  imports: [ReportCoreModule, AccountingReportModule, PrinterModule],
  controllers: [ReportsController],
  providers: [
    PaymentsMatrixService, 
    PaymentsMatrixPdfService,
    MonthlyCashflowService,
    MonthlyCashflowExcelService
  ],
})
export class ReportsModule {}
