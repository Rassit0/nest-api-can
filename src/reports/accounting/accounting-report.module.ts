import { Module } from '@nestjs/common';
import { GeneralAccountingReport } from './general/general-accounting.report';
import { CashClosuresReport } from './cash-closures/cash-closures.report';
import { AccountingAnalyticsModule } from 'src/accounting-analytics/accounting-analytics.module';
import { CashClosuresModule } from 'src/cash-closures/cash-closures.module';
import { PrinterModule } from 'src/printer/printer.module';

@Module({
  imports: [AccountingAnalyticsModule, CashClosuresModule, PrinterModule],
  providers: [GeneralAccountingReport, CashClosuresReport],
})
export class AccountingReportModule {}
