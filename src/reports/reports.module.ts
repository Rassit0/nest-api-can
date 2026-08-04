import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { AccountingReportModule } from './accounting/accounting-report.module';
import { ReportCoreModule } from './core/report-core.module';

@Module({
  imports: [ReportCoreModule, AccountingReportModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
