import { Module } from '@nestjs/common';
import { CashClosuresService } from './cash-closures.service';
import { CashClosuresController } from './cash-closures.controller';
import { CashClosuresAnalyticsService } from './cash-closures-analytics.service';

@Module({
  controllers: [CashClosuresController],
  providers: [CashClosuresService, CashClosuresAnalyticsService],
  exports: [CashClosuresAnalyticsService],
})
export class CashClosuresModule {}
