import { Module } from '@nestjs/common';
import { MatchCallUpsController } from './match-call-ups.controller';
import { MatchCallUpsService } from './match-call-ups.service';

@Module({
  controllers: [MatchCallUpsController],
  providers: [MatchCallUpsService],
  exports: [MatchCallUpsService],
})
export class MatchCallUpsModule {}
