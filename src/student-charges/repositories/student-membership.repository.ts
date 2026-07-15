import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipStatus, Prisma, StatusCourseSeason } from 'src/generated/prisma/client';
import { StudentMembershipWithRelations } from '../student-financial.calculator';

export const studentMembershipInclude = {
  paymentPlan: true,
  studentDiscounts: true,
  pauses: true,
  courseSeason: { include: { season: true, billingConfig: true, pauses: true } },
} as const;

@Injectable()
export class StudentMembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMembershipOrThrow(
    id: string,
  ): Promise<StudentMembershipWithRelations> {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
      include: studentMembershipInclude,
    });

    if (!membership) {
      throw new BadRequestException('Membresía no encontrada');
    }

    return membership;
  }

  async getMembershipById(
    id: string,
  ): Promise<StudentMembershipWithRelations | null> {
    return this.prisma.studentMembership.findUnique({
      where: { id },
      include: studentMembershipInclude,
    });
  }

  async getActiveMembershipsIdsBySeason(
    courseSeasonId: string,
  ): Promise<{ id: string }[]> {
    return this.prisma.studentMembership.findMany({
      where: { courseSeasonId, status: StatusCourseSeason.ACTIVE },
      select: { id: true },
    });
  }

  async getMembershipsForDailyGeneration(
    evaluationDate: Date,
  ): Promise<StudentMembershipWithRelations[]> {
    return this.prisma.studentMembership.findMany({
      where: {
        status: {
          in: [
            StatusCourseSeason.ACTIVE,
            StudentMembershipStatus.ACTIVE,
            StudentMembershipStatus.SUSPENDED,
          ],
        },
        OR: [
          { nextRecurringChargeGenerationDate: { lte: evaluationDate } },
          { nextRecurringChargeGenerationDate: null },
        ],
        courseSeason: {
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
      include: studentMembershipInclude,
    });
  }

  async updateNextGenerationPointer(
    tx: Prisma.TransactionClient | PrismaService,
    membershipId: string,
    nextPointer: Date | null,
  ): Promise<void> {
    await tx.studentMembership.update({
      where: { id: membershipId },
      data: { nextRecurringChargeGenerationDate: nextPointer },
    });
  }

  async getCourseSeasonOrThrow(id: string) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      include: { season: true, billingConfig: true, pauses: true },
    });
    if (!courseSeason)
      throw new BadRequestException('Temporada de equipo no encontrada');
    return courseSeason;
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


