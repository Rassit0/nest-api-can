import { PlayerMembershipStatus } from 'src/generated/prisma/client';
import { PlayerMembershipWithRelations } from '../membership-financial.calculator';

export class PreviewMembershipFactory {
  static createMockMembership(
    startedAt: Date,
    teamSeason: PlayerMembershipWithRelations['teamSeason'],
    paymentPlan: PlayerMembershipWithRelations['paymentPlan'],
    membershipDiscounts: PlayerMembershipWithRelations['membershipDiscounts'],
    isMigrated: boolean
  ): PlayerMembershipWithRelations {
    return {
      id: 'preview-id',
      playerId: 'preview-player-id',
      teamSeasonId: teamSeason.id,
      paymentPlanId: paymentPlan.id,
      status: PlayerMembershipStatus.ACTIVE,
      startedAt,
      isMigrated,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRecurringChargeGenerationDate: null,
      teamSeason,
      paymentPlan,
      membershipDiscounts,
    } as PlayerMembershipWithRelations;
  }
}
