import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { AccountingReportModule } from './accounting/accounting-report.module';
import { ReportCoreModule } from './core/report-core.module';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PaymentsMatrixPdfService } from './payments-matrix-pdf.service';

@Module({
  imports: [ReportCoreModule, AccountingReportModule],
  controllers: [ReportsController],
  providers: [PaymentsMatrixService, PaymentsMatrixPdfService],
})
export class ReportsModule {}
