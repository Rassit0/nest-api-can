import { Module } from '@nestjs/common';
import { CashClosuresService } from './cash-closures.service';
import { CashClosuresController } from './cash-closures.controller';

@Module({
  controllers: [CashClosuresController],
  providers: [CashClosuresService],
})
export class CashClosuresModule {}
