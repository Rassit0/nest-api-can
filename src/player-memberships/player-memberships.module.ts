import { Module } from '@nestjs/common';
import { PlayerMembershipsService } from './player-memberships.service';
import { PlayerMembershipsController } from './player-memberships.controller';
import { PrismaService } from 'src/prisma.service';
import { MembershipChargesModule } from 'src/membership-charges/membership-charges.module';

@Module({
  imports: [MembershipChargesModule],
  controllers: [PlayerMembershipsController],
  providers: [PlayerMembershipsService, PrismaService],
})
export class PlayerMembershipsModule {}
