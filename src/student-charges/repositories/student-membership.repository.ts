import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  StatusCourseSeason,
} from 'src/generated/prisma/client';
import { StudentMembershipWithRelations } from '../student-financial.calculator';

export const studentMembershipInclude = {
  paymentPlan: true,
  studentDiscounts: true,
  pauses: true,
  courseSeason: {
    include: { season: true, billingConfig: true, pauses: true },
  },
  student: { select: { personId: true } },
} as const;

@Injectable()
export class StudentMembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getMembershipOrThrow(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StudentMembershipWithRelations> {
    const prisma = tx || this.prisma;
    const membership = await prisma.studentMembership.findUnique({
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
    tx?: Prisma.TransactionClient,
  ): Promise<StudentMembershipWithRelations | null> {
    const prisma = tx || this.prisma;
    return prisma.studentMembership.findUnique({
      where: { id },
      include: studentMembershipInclude,
    });
  }

  async getActiveMembershipsIdsBySeason(
    courseSeasonId: string,
  ): Promise<{ id: string }[]> {
    return this.prisma.studentMembership.findMany({
      where: { courseSeasonId, status: StudentMembershipStatus.ACTIVE },
      select: { id: true },
    });
  }

  async getCourseSeasonOrThrow(id: string) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      include: { season: true, billingConfig: true, pauses: true },
    });
    if (!courseSeason)
      throw new BadRequestException('Temporada de curso no encontrada');
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
