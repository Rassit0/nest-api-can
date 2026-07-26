import { Prisma, StudentMembershipStatus } from 'src/generated/prisma/client';
import { StudentMembershipWithRelations } from '../student-financial.calculator';
import { PreviewStudentChargesDto } from '../dto/preview-student-charges.dto';

export class PreviewStudentFactory {
  static parseDiscounts(
    rawDiscounts?: PreviewStudentChargesDto['studentDiscounts'],
  ): StudentMembershipWithRelations['studentDiscounts'] {
    if (!rawDiscounts) return [];
    return rawDiscounts.map((d) => ({
      ...d,
      id: 'preview-discount',
      createdAt: new Date(),
      updatedAt: new Date(),
      studentMembershipId: 'preview-id',
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
    })) as unknown as StudentMembershipWithRelations['studentDiscounts'];
  }
  static createMockMembership(
    startedAt: Date,
    courseSeason: StudentMembershipWithRelations['courseSeason'],
    paymentPlan: StudentMembershipWithRelations['paymentPlan'],
    studentDiscounts: StudentMembershipWithRelations['studentDiscounts'],
    isMigrated: boolean,
    chargeRegistrationOnMigration?: boolean,
    chargeCurrentMonthOnMigration?: boolean,
  ): StudentMembershipWithRelations {
    return {
      id: 'preview-id',
      studentId: 'preview-student-id',
      courseSeasonId: courseSeason.id,
      paymentPlanId: paymentPlan.id,
      status: StudentMembershipStatus.ACTIVE,
      startedAt,
      isMigrated,
      chargeRegistrationOnMigration,
      chargeCurrentMonthOnMigration,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRecurringChargeGenerationDate: null,
      courseSeason,
      paymentPlan,
      studentDiscounts,
    } as StudentMembershipWithRelations;
  }
}
