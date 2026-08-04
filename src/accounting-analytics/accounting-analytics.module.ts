import { Module } from '@nestjs/common';
import { AccountingAnalyticsService } from './accounting-analytics.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [AccountingAnalyticsService, PrismaService],
  exports: [AccountingAnalyticsService],
})
export class AccountingAnalyticsModule {}
