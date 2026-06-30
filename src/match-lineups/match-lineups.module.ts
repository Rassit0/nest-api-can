import { Module } from '@nestjs/common';
import { MatchLineupsService } from './match-lineups.service';
import { MatchLineupsController } from './match-lineups.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [MatchLineupsController],
  providers: [MatchLineupsService, PrismaService],
})
export class MatchLineupsModule {}
