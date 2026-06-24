import { Module } from '@nestjs/common';
import { PlayerMembershipsService } from './player-memberships.service';
import { PlayerMembershipsController } from './player-memberships.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [PlayerMembershipsController],
  providers: [PlayerMembershipsService, PrismaService],
})
export class PlayerMembershipsModule {}
