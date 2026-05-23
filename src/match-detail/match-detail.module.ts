import { Module } from '@nestjs/common';
import { MatchDetailService } from './match-detail.service';
import { MatchDetailController } from './match-detail.controller';

@Module({
  controllers: [MatchDetailController],
  providers: [MatchDetailService],
})
export class MatchDetailModule {}
