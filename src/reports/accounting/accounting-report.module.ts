import { Module } from '@nestjs/common';
import { GeneralAccountingReport } from './general/general-accounting.report';
import { AccountingAnalyticsModule } from 'src/accounting-analytics/accounting-analytics.module';
import { PrinterModule } from 'src/printer/printer.module';

@Module({
  imports: [AccountingAnalyticsModule, PrinterModule],
  providers: [GeneralAccountingReport],
})
export class AccountingReportModule {}
