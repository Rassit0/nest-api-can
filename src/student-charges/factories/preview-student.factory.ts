import { StudentMembershipStatus, StatusCourseSeason } from 'src/generated/prisma/client';
import { StudentMembershipWithRelations } from '../student-financial.calculator';

export class PreviewMembershipFactory {
  static createMockMembership(
    startedAt: Date,
    courseSeason: StudentMembershipWithRelations['courseSeason'],
    paymentPlan: StudentMembershipWithRelations['paymentPlan'],
    studentDiscounts: StudentMembershipWithRelations['studentDiscounts'],
    isMigrated: boolean
  ): StudentMembershipWithRelations {
    return {
      id: 'preview-id',
      studentId: 'preview-student-id',
      courseSeasonId: courseSeason.id,
      paymentPlanId: paymentPlan.id,
      status: StatusCourseSeason.ACTIVE,
      startedAt,
      isMigrated,
      createdAt: new Date(),
      updatedAt: new Date(),
      nextRecurringChargeGenerationDate: null,
      courseSeason,
      paymentPlan,
      studentDiscounts,
    } as StudentMembershipWithRelations;
  }
}

