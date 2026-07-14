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
}> & { minBirthYear: number | null; maxBirthYear: number | null };

import { StudentChargesService } from 'src/student-charges/student-charges.service';

@Injectable()
export class StudentMembershipsService {
  private readonly logger = new Logger('StudentMembershipsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentChargesService: StudentChargesService,
  ) {}

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

    if (createDto.studentDiscounts && createDto.studentDiscounts.length > 0) {
      this.validateDiscountDates(
        createDto.studentDiscounts,
        offering.season.startDate,
        offering.season.endDate,
      );
    }

    const { studentDiscounts, ...createData } = createDto;

    const membership = await this.prisma.studentMembership.create({
      data: {
        ...createData,
        ...(studentDiscounts &&
          studentDiscounts.length > 0 && {
            studentDiscounts: {
              create: studentDiscounts.map((d) => ({
                ...d,
                startDate: new Date(d.startDate),
                endDate: d.endDate ? new Date(d.endDate) : null,
              })),
            },
          }),
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción de estudiante a curso escolar creada exitosamente',
      data: membership,
    };
  }

  private calculateAge(birthDate: Date, referenceDate: Date): number {
    return referenceDate.getFullYear() - birthDate.getFullYear();
  }

  private validateStudentAge(
    birthDate: Date,
    referenceDate: Date,
    minAge?: number,
    maxAge?: number,
  ) {
    const studentAge = this.calculateAge(birthDate, referenceDate);

    if (maxAge && studentAge > maxAge) {
      throw new BadRequestException('errors.INVALID_AGE_FOR_CATEGORY');
    }

    if (minAge && studentAge < minAge) {
      throw new BadRequestException('errors.INVALID_AGE_FOR_CATEGORY');
    }
  }

  private validateDiscountDates(
    discounts: any[],
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    for (const d of discounts) {
      const dStart = new Date(d.startDate);
      if (dStart < seasonStartDate || dStart > seasonEndDate) {
        throw new BadRequestException(
          `La fecha de inicio del descuento (${dStart.toLocaleDateString()}) debe estar dentro de la temporada (${seasonStartDate.toLocaleDateString()} - ${seasonEndDate.toLocaleDateString()})`,
        );
      }
      if (d.endDate) {
        const dEnd = new Date(d.endDate);
        if (dEnd < dStart) {
          throw new BadRequestException(
            'La fecha de fin del descuento no puede ser menor a la fecha de inicio',
          );
        }
        if (dEnd > seasonEndDate) {
          throw new BadRequestException(
            `La fecha de fin del descuento (${dEnd.toLocaleDateString()}) no puede exceder el fin de la temporada (${seasonEndDate.toLocaleDateString()})`,
          );
        }
      }
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

    const { studentDiscounts, ...updateData } = updateDto;

    const updatedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: updateData,
      select: studentMembershipSelect,
    });

    if (
      updateDto.paymentPlanId &&
      updateDto.paymentPlanId !== membership.paymentPlanId
    ) {
      this.studentChargesService
        .recalculatePendingFutureCharges(id)
        .catch((e) => {
          this.logger.error(
            `Error al recalcular cargos tras cambio de plan en membresía de estudiante ${id}`,
            e.stack,
          );
        });
    }

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
    maxMembers: number | null,
  ) {
    if (maxMembers === null) return;

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
    if (offering.minBirthYear || offering.maxBirthYear) {
      const birthYear = student.person.birthDate.getFullYear();
      if (offering.maxBirthYear && birthYear > offering.maxBirthYear) {
        throw new BadRequestException(
          `El año de nacimiento del estudiante (${birthYear}) supera el año máximo permitido (${offering.maxBirthYear}) para esta temporada.`,
        );
      }
      if (offering.minBirthYear && birthYear < offering.minBirthYear) {
        throw new BadRequestException(
          `El año de nacimiento del estudiante (${birthYear}) es inferior al año mínimo permitido (${offering.minBirthYear}) para esta temporada.`,
        );
      }
    } else {
      this.validateStudentAge(
        student.person.birthDate,
        offering.season.startDate,
        offering.category.minAge,
        offering.category.maxAge,
      );
    }
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

  // MÉTODOS DE PAUSA
  async getPauses(membershipId: string) {
    const pauses = await this.prisma.studentMembershipPause.findMany({
      where: { studentMembershipId: membershipId },
      orderBy: { startDate: 'desc' },
    });
    return { message: 'Pausas obtenidas exitosamente', data: pauses };
  }

  async createPause(
    membershipId: string,
    dto: import('./dto/create-student-membership-pause.dto').CreateStudentMembershipPauseDto,
  ) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id: membershipId },
      include: {
        courseSeason: { include: { season: true } },
        pauses: true,
      },
    });
    if (!membership) {
      throw new NotFoundException(`Membresía ${membershipId} no encontrada`);
    }
    if (
      membership.status === StudentMembershipStatus.FINISHED ||
      membership.status === StudentMembershipStatus.WITHDRAWN
    ) {
      throw new BadRequestException(
        'No se pueden agregar pausas a una membresía finalizada o retirada',
      );
    }

    if (dto.startDate > dto.endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior o igual a la de fin',
      );
    }

    const seasonStart = new Date(membership.courseSeason.season.startDate);
    seasonStart.setUTCHours(0, 0, 0, 0);
    const seasonEnd = new Date(membership.courseSeason.season.endDate);
    seasonEnd.setUTCHours(23, 59, 59, 999);

    const pauseStart = new Date(dto.startDate);
    pauseStart.setUTCHours(0, 0, 0, 0);
    const pauseEnd = new Date(dto.endDate);
    pauseEnd.setUTCHours(23, 59, 59, 999);

    if (pauseStart < seasonStart || pauseEnd > seasonEnd) {
      const sStart = seasonStart.toISOString().split('T')[0];
      const sEnd = seasonEnd.toISOString().split('T')[0];
      throw new BadRequestException(
        `Las fechas de la pausa deben estar dentro de la duración de la temporada (${sStart} al ${sEnd})`,
      );
    }

    const overlappingPause = membership.pauses.find((p) => {
      const existingStart = new Date(p.startDate);
      existingStart.setUTCHours(0, 0, 0, 0);
      const existingEnd = new Date(p.endDate);
      existingEnd.setUTCHours(23, 59, 59, 999);
      return pauseStart <= existingEnd && pauseEnd >= existingStart;
    });

    if (overlappingPause) {
      const pStart = new Date(overlappingPause.startDate).toISOString().split('T')[0];
      const pEnd = new Date(overlappingPause.endDate).toISOString().split('T')[0];
      throw new BadRequestException(
        `El rango de fechas se superpone con una pausa existente (${pStart} al ${pEnd})`,
      );
    }

    const pause = await this.prisma.studentMembershipPause.create({
      data: {
        studentMembershipId: membershipId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
      },
    });

    const todayZero = new Date();
    todayZero.setUTCHours(0, 0, 0, 0);

    if (
      pauseStart <= todayZero &&
      pauseEnd >= todayZero &&
      membership.status === 'ACTIVE'
    ) {
      await this.prisma.studentMembership.update({
        where: { id: membershipId },
        data: {
          status: 'SUSPENDED',
          notes: dto.reason || 'Pausa iniciada automáticamente',
        },
      });
    }

    return { message: 'Pausa creada exitosamente', data: pause };
  }

  async removePause(membershipId: string, pauseId: string) {
    const pause = await this.prisma.studentMembershipPause.findUnique({
      where: { id: pauseId },
    });
    if (!pause || pause.studentMembershipId !== membershipId) {
      throw new NotFoundException(`Pausa ${pauseId} no encontrada`);
    }

    await this.prisma.studentMembershipPause.delete({
      where: { id: pauseId },
    });

    return { message: 'Pausa eliminada exitosamente' };
  }
}
