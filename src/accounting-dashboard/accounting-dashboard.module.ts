import { Module } from '@nestjs/common';
import { AccountingDashboardService } from './accounting-dashboard.service';
import { AccountingDashboardController } from './accounting-dashboard.controller';
import { PrismaService } from 'src/prisma.service';

import { AccountingAnalyticsModule } from 'src/accounting-analytics/accounting-analytics.module';

@Module({
  imports: [AccountingAnalyticsModule],
  controllers: [AccountingDashboardController],
  providers: [AccountingDashboardService, PrismaService],
  exports: [AccountingDashboardService],
})
export class AccountingDashboardModule {}
