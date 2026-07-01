import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentMembershipDto } from './dto/create-student-membership.dto';
import { UpdateStudentMembershipDto } from './dto/update-student-membership.dto';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipStatus, Prisma } from 'src/generated/prisma/client';
import { StudentMembershipsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const studentMembershipSelect: Prisma.StudentMembershipSelect = {
  id: true,
  studentId: true,
  student: {
    select: {
      person: {
        select: {
          name: true,
          lastName: true,
          secondLastName: true,
          email: true,
          phone: true,
          birthDate: true,
        },
      },
    },
  },
  courseSeasonId: true,
  paymentPlanId: true,
  startedAt: true,
  endedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

type StudentWithPerson = Prisma.StudentGetPayload<{
  include: {
    person: true;
  };
}>;

type CourseMembershipOfferingWithCategory = Prisma.CourseSeasonGetPayload<{
  include: {
    category: {
      select: {
        minAge: true;
        maxAge: true;
      };
    };
    season: {
      select: {
        startDate: true;
        endDate: true;
      };
    };
  };
}>;

@Injectable()
export class StudentMembershipsService {
  private readonly logger = new Logger('StudentMembershipsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateStudentMembershipDto) {
    await this.validatePaymentPlan(
      createDto.paymentPlanId,
      createDto.courseSeasonId,
    );

    const [student, offering] = await Promise.all([
      this.getStudent(createDto.studentId),
      this.getCourseMembershipOffering(createDto.courseSeasonId),
    ]);

    this.validateMembershipStartDate(
      new Date(createDto.startedAt),
      offering.season.startDate,
      offering.season.endDate,
    );

    await this.validateOfferingCapacity(offering.id, offering.maxMembers);

    await this.validateDuplicateMembership(
      createDto.studentId,
      createDto.courseSeasonId,
    );

    this.validateStudentEligibility(student, offering);

    const membership = await this.prisma.studentMembership.create({
      data: createDto,
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción de estudiante a curso escolar creada exitosamente',
      data: membership,
    };
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  private validateStudentAge(
    birthDate: Date,
    minAge?: number,
    maxAge?: number,
  ) {
    const studentAge = this.calculateAge(birthDate);

    if (maxAge && studentAge > maxAge) {
      throw new BadRequestException('errors.INVALID_AGE_FOR_CATEGORY');
    }

    if (minAge && studentAge < minAge) {
      throw new BadRequestException('errors.INVALID_AGE_FOR_CATEGORY');
    }
  }

  async findAll(paginationDto: StudentMembershipsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      courseSeasonId,
      studentId,
      status,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.StudentMembershipWhereInput = {};

    if (courseSeasonId) {
      where.courseSeasonId = courseSeasonId;
    }
    if (studentId) {
      where.studentId = studentId;
    }
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          student: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [memberships, totalItems] = await Promise.all([
      this.prisma.studentMembership.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: studentMembershipSelect,
      }),
      this.prisma.studentMembership.count({ where }),
    ]);

    return createPaginationResult(
      memberships,
      totalItems,
      page,
      per_page,
      'Inscripciones escolares obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
      select: studentMembershipSelect,
    });
    if (!membership) {
      throw new NotFoundException('errors.MEMBERSHIP_NOT_FOUND');
    }
    return {
      message: 'Inscripción escolar obtenida exitosamente',
      data: membership,
    };
  }

  async update(id: string, updateDto: UpdateStudentMembershipDto) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('errors.MEMBERSHIP_NOT_FOUND');
    }

    const studentId = updateDto.studentId ?? membership.studentId;
    const offeringId = updateDto.courseSeasonId ?? membership.courseSeasonId;

    if (updateDto.paymentPlanId) {
      await this.validatePaymentPlan(updateDto.paymentPlanId, offeringId);
    }

    const [student, offering] = await Promise.all([
      this.getStudent(studentId),
      this.getCourseMembershipOffering(offeringId),
    ]);

    this.validateMembershipStartDate(
      updateDto.startedAt
        ? new Date(updateDto.startedAt)
        : membership.startedAt,
      offering.season.startDate,
      offering.season.endDate,
    );

    this.validateStudentEligibility(student, offering);

    const isChangingOffering =
      updateDto.courseSeasonId &&
      updateDto.courseSeasonId !== membership.courseSeasonId;

    if (isChangingOffering) {
      await this.validateOfferingCapacity(offering.id, offering.maxMembers);
      await this.validateDuplicateMembership(studentId, offeringId, id);
    }

    const updatedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: updateDto,
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar actualizada exitosamente',
      data: updatedMembership,
    };
  }

  async finish(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.FINISHED) {
      throw new BadRequestException('errors.FINISH_ONLY_ACTIVE_OR_SUSPENDED');
    }

    const finishedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.FINISHED,
        endedAt: new Date(),
        notes: reason,
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar finalizada exitosamente',
      data: finishedMembership,
    };
  }

  async suspend(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException('errors.SUSPEND_ONLY_ACTIVE');
    }

    const suspendedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.SUSPENDED,
        notes: reason,
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar suspendida exitosamente',
      data: suspendedMembership,
    };
  }

  async withdraw(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.WITHDRAWN) {
      throw new BadRequestException('errors.MEMBERSHIP_ALREADY_WITHDRAWN');
    }

    const withdrawnMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.WITHDRAWN,
        endedAt: new Date(),
        notes: reason,
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar retirada exitosamente',
      data: withdrawnMembership,
    };
  }

  async reactivate(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status !== StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException('errors.REACTIVATE_ONLY_SUSPENDED');
    }

    const updatedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.ACTIVE,
        notes: reason,
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar reactivada exitosamente',
      data: updatedMembership,
    };
  }

  async remove(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('errors.MEMBERSHIP_NOT_FOUND');
    }

    const deletedMembership = await this.prisma.studentMembership.delete({
      where: { id },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar eliminada exitosamente',
      data: deletedMembership,
    };
  }

  private async getMembership(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('errors.MEMBERSHIP_NOT_FOUND');
    }
    return membership;
  }

  private async validatePaymentPlan(
    paymentPlanId: string,
    courseSeasonId: string,
  ) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
    });
    if (!paymentPlan) {
      throw new BadRequestException('errors.PAYMENT_PLAN_NOT_FOUND');
    }
    if (paymentPlan.courseSeasonId !== courseSeasonId) {
      throw new BadRequestException('errors.PLAN_NOT_BELONGS');
    }
  }

  private async getStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { person: true },
    });
    if (!student) {
      throw new NotFoundException('errors.STUDENT_NOT_FOUND');
    }
    return student;
  }

  private async getCourseMembershipOffering(courseSeasonId: string) {
    const offering = await this.prisma.courseSeason.findUnique({
      where: { id: courseSeasonId },
      include: {
        category: {
          select: { minAge: true, maxAge: true },
        },
        season: {
          select: { startDate: true, endDate: true },
        },
      },
    });
    if (!offering) {
      throw new NotFoundException('errors.COURSE_SEASON_NOT_FOUND');
    }
    return offering;
  }

  private async validateOfferingCapacity(
    offeringId: string,
    maxMembers: number,
  ) {
    const activeMembers = await this.prisma.studentMembership.count({
      where: {
        courseSeasonId: offeringId,
        status: {
          in: [
            StudentMembershipStatus.ACTIVE,
            StudentMembershipStatus.SUSPENDED,
          ],
        },
      },
    });
    if (activeMembers >= maxMembers) {
      throw new BadRequestException('errors.NO_VACANCIES_AVAILABLE');
    }
  }

  private async validateDuplicateMembership(
    studentId: string,
    courseSeasonId: string,
    currentMembershipId?: string,
  ) {
    const existingMembership = await this.prisma.studentMembership.findFirst({
      where: {
        studentId,
        courseSeasonId,
        ...(currentMembershipId && {
          NOT: { id: currentMembershipId },
        }),
      },
    });
    if (existingMembership) {
      throw new BadRequestException('errors.STUDENT_ALREADY_ENROLLED');
    }
  }

  private validateStudentEligibility(
    student: StudentWithPerson,
    offering: CourseMembershipOfferingWithCategory,
  ) {
    if (!student.isActive) {
      throw new BadRequestException('errors.STUDENT_INACTIVE');
    }
    if (!student.person.birthDate) {
      throw new BadRequestException('errors.BIRTHDATE_NOT_FOUND');
    }
    this.validateStudentAge(
      student.person.birthDate,
      offering.category.minAge,
      offering.category.maxAge,
    );
    if (
      offering.gender !== 'MIXED' &&
      offering.gender !== student.person.gender
    ) {
      throw new BadRequestException('errors.INVALID_GENDER_FOR_CATEGORY');
    }
  }

  private validateMembershipStartDate(
    startedAt: Date,
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    if (startedAt < seasonStartDate || startedAt > seasonEndDate) {
      throw new BadRequestException('errors.INVALID_DATE_FOR_SEASON');
    }
  }
}
