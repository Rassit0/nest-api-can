import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, Prisma } from 'src/generated/prisma/client';
import { PlayerMembershipWithRelations } from '../membership-financial.calculator';

export const playerMembershipInclude = {
  paymentPlan: true,
  membershipDiscounts: true,
  pauses: true,
  teamSeason: { include: { season: true, billingConfig: true, teamSeasonPauses: true } },
} as const;

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMembershipOrThrow(
    id: string,
  ): Promise<PlayerMembershipWithRelations> {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id },
      include: playerMembershipInclude,
    });

    if (!membership) {
      throw new BadRequestException('Membresía no encontrada');
    }

    return membership;
  }

  async getMembershipById(
    id: string,
  ): Promise<PlayerMembershipWithRelations | null> {
    return this.prisma.playerMembership.findUnique({
      where: { id },
      include: playerMembershipInclude,
    });
  }

  async getActiveMembershipsIdsBySeason(
    teamSeasonId: string,
  ): Promise<{ id: string }[]> {
    return this.prisma.playerMembership.findMany({
      where: { teamSeasonId, status: PlayerMembershipStatus.ACTIVE },
      select: { id: true },
    });
  }

  async getMembershipsForDailyGeneration(
    evaluationDate: Date,
  ): Promise<PlayerMembershipWithRelations[]> {
    return this.prisma.playerMembership.findMany({
      where: {
        status: {
          in: [
            PlayerMembershipStatus.ACTIVE,
            PlayerMembershipStatus.PENDING_ACTIVE,
            PlayerMembershipStatus.SUSPENDED,
          ],
        },
        OR: [
          { nextRecurringChargeGenerationDate: { lte: evaluationDate } },
          { nextRecurringChargeGenerationDate: null },
        ],
        teamSeason: {
          status: 'ACTIVE',
          billingConfig: {
            isEngineActive: true,
          },
          season: {
            endDate: { gte: evaluationDate },
            status: { in: ['ACTIVE'] },
          },
        },
      },
      include: playerMembershipInclude,
    });
  }

  async updateNextGenerationPointer(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    nextPointer: Date | null,
  ): Promise<void> {
    await tx.playerMembership.update({
      where: { id: membershipId },
      data: { nextRecurringChargeGenerationDate: nextPointer },
    });
  }

  async getTeamSeasonOrThrow(id: string) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      include: { season: true, billingConfig: true, teamSeasonPauses: true },
    });
    if (!teamSeason)
      throw new BadRequestException('Temporada de equipo no encontrada');
    return teamSeason;
  }

  async getPaymentPlanOrThrow(id: string) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id },
    });
    if (!paymentPlan)
      throw new BadRequestException('Plan de pago no encontrado');
    return paymentPlan;
  }
}
