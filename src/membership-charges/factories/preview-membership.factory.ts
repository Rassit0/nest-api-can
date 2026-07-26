import { Prisma, PlayerMembershipStatus } from 'src/generated/prisma/client';
import { PlayerMembershipWithRelations } from '../membership-financial.calculator';
import { PreviewMembershipChargesDto } from '../dto/preview-membership-charges.dto';

export class PreviewMembershipFactory {
  static parseDiscounts(
    rawDiscounts?: PreviewMembershipChargesDto['membershipDiscounts'],
  ): PlayerMembershipWithRelations['membershipDiscounts'] {
    if (!rawDiscounts) return [];
    return rawDiscounts.map((d) => ({
      ...d,
      id: 'preview-discount',
      createdAt: new Date(),
      updatedAt: new Date(),
      playerMembershipId: 'preview-id',
      type: 'CUSTOM' as const,
      reason: 'Preview',
      registrationDiscountPercent: new Prisma.Decimal(
        d.registrationDiscountPercent || 0,
      ),
      recurringDiscountPercent: new Prisma.Decimal(
        d.recurringDiscountPercent || 0,
      ),
      seasonFeeDiscountPercent: new Prisma.Decimal(
        d.seasonFeeDiscountPercent || 0,
      ),
      startDate: new Date(d.startDate),
      endDate: d.endDate ? new Date(d.endDate) : null,
    })) as unknown as PlayerMembershipWithRelations['membershipDiscounts'];
  }
  static createMockMembership(
    startedAt: Date,
    teamSeason: PlayerMembershipWithRelations['teamSeason'],
    paymentPlan: PlayerMembershipWithRelations['paymentPlan'],
    membershipDiscounts: PlayerMembershipWithRelations['membershipDiscounts'],
    isMigrated: boolean,
    chargeRegistrationOnMigration?: boolean,
    chargeCurrentMonthOnMigration?: boolean,
  ): PlayerMembershipWithRelations {
    return {
      id: 'preview-id',
      playerId: 'preview-player-id',
      teamSeasonId: teamSeason.id,
      paymentPlanId: paymentPlan.id,
      status: PlayerMembershipStatus.ACTIVE,
      startedAt,
      isMigrated,
      chargeRegistrationOnMigration,
      chargeCurrentMonthOnMigration,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRecurringChargeGenerationDate: null,
      teamSeason,
      paymentPlan,
      membershipDiscounts,
    } as PlayerMembershipWithRelations;
  }
}
