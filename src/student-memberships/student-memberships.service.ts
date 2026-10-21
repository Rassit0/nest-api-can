import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentMembershipDto } from './dto/create-student-membership.dto';
import { UpdateStudentMembershipDto } from './dto/update-student-membership.dto';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  StatusCourseSeason,
  StatusCharge,
  CycleEnrollmentStatus,
} from 'src/generated/prisma/client';
import { StudentMembershipsPaginationDto } from './dto/pagination.dto';
import { PaginationDto } from 'src/common/dto/pagination';
import { CreateStudentMembershipPauseDto } from './dto/create-student-membership-pause.dto';
import { validateCourseSeasonCapacity } from 'src/common/helpers/capacity.helper';
import { TransferShiftDto } from './dto/transfer-shift.dto';
import { isCycleEnrollmentExpired } from 'src/common/helpers/cycle-enrollment.helper';
import { syncCycleEnrollmentStatus } from 'src/common/helpers/sync-cycle-enrollment.helper';
import { lockChargeForUpdate } from 'src/common/utils/charge-lock.util';
import { ReenterStudentMembershipDto } from './dto/reenter-student-membership.dto';

export const studentMembershipSelect = {
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
          documentNumber: true,
          documentType: true,
        },
      },
    },
  },
  courseSeasonId: true,
  courseSeason: {
    select: {
      course: {
        select: {
          id: true,
          name: true,
          schoolId: true,
          school: {
            select: {
              disciplineId: true,
            },
          },
        },
      },
      season: {
        select: {
          name: true,
        },
      },
    },
  },
  courseSeasonShiftId: true,
  courseSeasonShift: {
    select: {
      shift: { select: { name: true } },
      category: { select: { name: true } },
    },
  },
  paymentPlanId: true,
  paymentPlan: true,
  startedAt: true,
  endedAt: true,
  reenteredAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  cycleEnrollments: {
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    orderBy: { cycleStartDate: 'asc' },
  },
  studentCharges: {
    where: {
      charge: {
        status: {
          not: 'CANCELLED',
        },
      },
    },
    select: {
      charge: {
        select: {
          pendingAmount: true,
          amount: true,
          adjustmentAmount: true,
        },
      },
    },
  },
} satisfies Prisma.StudentMembershipSelect;

type StudentMembershipWithCharges = Prisma.StudentMembershipGetPayload<{
  select: typeof studentMembershipSelect;
}>;

const mapMembershipWithTotal = (membership: StudentMembershipWithCharges) => {
  const totalPendingAmount = Number(
    (
      membership.studentCharges?.reduce(
        (sum, current) => sum + Number(current.charge.pendingAmount),
        0,
      ) || 0
    ).toFixed(2),
  );

  const totalPaidAmount = Number(
    (
      membership.studentCharges?.reduce(
        (sum, current) =>
          sum +
          (Number(current.charge.amount) +
            Number(current.charge.adjustmentAmount || 0) -
            Number(current.charge.pendingAmount)),
        0,
      ) || 0
    ).toFixed(2),
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { studentCharges, ...rest } = membership;

  return {
    ...rest,
    totalPendingAmount,
    totalPaidAmount,
  };
};

type StudentWithPerson = Prisma.StudentGetPayload<{
  include: {
    person: true;
  };
}>;

type CourseSeasonShiftWithEligibility = Prisma.CourseSeasonShiftGetPayload<{
  include: {
    category: {
      select: {
        minAge: true;
        maxAge: true;
      };
    };
    courseSeason: {
      include: {
        season: {
          select: {
            startDate: true;
            endDate: true;
          };
        };
      };
    };
  };
}>;

import { StudentChargesService } from 'src/student-charges/student-charges.service';
import { StudentsOptionsPaginationDto } from './dto/students-options-pagination.dto';

@Injectable()
export class StudentMembershipsService {
  private readonly logger = new Logger('StudentMembershipsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentChargesService: StudentChargesService,
  ) {}

  async create(createDto: CreateStudentMembershipDto) {
    if (!createDto.studentId && !createDto.personIdToCreateProfile) {
      throw new BadRequestException(
        'Se debe proveer studentId o personIdToCreateProfile',
      );
    }
    if (createDto.studentId && createDto.personIdToCreateProfile) {
      throw new BadRequestException(
        'No se puede enviar studentId y personIdToCreateProfile simultáneamente',
      );
    }

    await this.validatePaymentPlan(
      createDto.paymentPlanId,
      createDto.courseSeasonId,
    );

    const offeringData = await this.getCourseMembershipOfferingAndShift(
      createDto.courseSeasonId,
      createDto.courseSeasonShiftId,
    );
    const offering = offeringData.courseSeason;
    const shift = offeringData.shift;

    this.validateMembershipStartDate(
      new Date(createDto.startedAt),
      offering.season.startDate,
      offering.season.endDate,
    );

    await this.validateOfferingCapacity(shift.id, shift.maxMembers);

    const {
      studentDiscounts,
      chargeRegistrationOnMigration,
      chargeCurrentMonthOnMigration,
      chargeRegistration,
      chargeInitialCycle,
      forceFullCycleFee,
      personIdToCreateProfile,
      studentId,
      ...createData
    } = createDto;

    return await this.prisma.$transaction(
      async (tx) => {
        let student;
        let finalStudentId = studentId;

        if (personIdToCreateProfile) {
          const person = await tx.person.findUnique({
            where: { id: personIdToCreateProfile },
          });
          if (!person) {
            throw new NotFoundException('Persona no encontrada');
          }

          student = await tx.student.upsert({
            where: { personId: personIdToCreateProfile },
            update: {},
            create: { personId: personIdToCreateProfile, isActive: true },
            include: { person: true },
          });
          finalStudentId = student.id;
        } else {
          student = await tx.student.findUnique({
            where: { id: finalStudentId },
            include: { person: true },
          });
          if (!student) {
            throw new NotFoundException(`Estudiante con id ${finalStudentId} no encontrado`);
          }
        }

        await this.validateDuplicateMembership(
          finalStudentId,
          createDto.courseSeasonId,
          undefined,
          tx,
        );

        this.validateStudentEligibility(student as any, shift);

        if (studentDiscounts && studentDiscounts.length > 0) {
          this.validateDiscountDates(
            studentDiscounts,
            offering.season.startDate,
            offering.season.endDate,
          );
        }

        // Adquirir lock pesimista sobre CourseSeason tempranamente para serializar
        // la concurrencia y evitar FK deadlocks al insertar StudentMembership.
        await tx.$queryRaw`
        SELECT 1 
        FROM course_seasons 
        WHERE id = ${createDto.courseSeasonId} 
        FOR UPDATE
      `;

        const membership = await tx.studentMembership.create({
          data: {
            ...createData,
            studentId: finalStudentId,
            status: createData.status ?? StudentMembershipStatus.ACTIVE,
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
            histories: {
              create: {
                previousStatus: null,
                newStatus: createData.status ?? StudentMembershipStatus.ACTIVE,
                reason: createData.notes ?? 'Creación de inscripción',
              },
            },
          },
          select: studentMembershipSelect,
        });

        // Generar cargos inmediatamente después de crear la membresía
        const generatedChargeIds = await this.studentChargesService.generateChargesForNewMembership(
          membership.id,
          {
            chargeRegistrationOnMigration,
            chargeCurrentMonthOnMigration,
            chargeRegistration,
            chargeInitialCycle,
            forceFullCycleFee,
          },
          tx,
        );

        return {
          message:
            'Inscripción de estudiante a curso escolar creada exitosamente',
          data: mapMembershipWithTotal(membership),
          generatedChargeIds,
        };
      },
      { timeout: 15000 },
    );
  }

  private calculateAge(birthDate: Date, referenceDate: Date): number {
    return referenceDate.getFullYear() - birthDate.getFullYear();
  }

  private validateStudentAge(
    birthDate: Date,
    referenceDate: Date,
    minAge?: number,
    maxAge?: number | null,
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
      sortField = 'lastName',
      courseSeasonId,
      courseSeasonShiftId,
      studentId,
      paymentPlanId,
      status,
      physicalDate,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.StudentMembershipWhereInput = {};

    if (studentId) {
      where.studentId = studentId;
    }

    if (courseSeasonId) {
      if (physicalDate) {
        const pDate = new Date(physicalDate);
        where.cycleEnrollments = {
          some: {
            courseSeasonId: courseSeasonId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            effectiveStartDate: { lte: pDate },
            cycleEndDate: { gt: pDate },
          },
        };
      } else {
        where.courseSeasonId = courseSeasonId;
      }
    }

    if (courseSeasonShiftId) {
      where.courseSeasonShiftId = courseSeasonShiftId;
    }

    if (paymentPlanId) {
      where.paymentPlanId = paymentPlanId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      const searchTerms = search.trim().split(/\s+/);
      if (searchTerms.length > 0) {
        where.student = {
          person: {
            AND: searchTerms.map((term) => ({
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { secondLastName: { contains: term, mode: 'insensitive' } },
                { documentNumber: { contains: term, mode: 'insensitive' } },
              ],
            })),
          },
        };
      }
    }

    const globalWhere: Prisma.StudentMembershipWhereInput = {};
    if (studentId) globalWhere.studentId = studentId;
    if (courseSeasonId) globalWhere.courseSeasonId = courseSeasonId;
    if (courseSeasonShiftId)
      globalWhere.courseSeasonShiftId = courseSeasonShiftId;
    if (paymentPlanId) globalWhere.paymentPlanId = paymentPlanId;

    const [
      studentMemberships,
      totalItems,
      allCharges,
      activeMembersCount,
      suspendedMembersCount,
      pendingActiveMembersCount,
      courseSeasonData,
    ] = await Promise.all([
      this.prisma.studentMembership.findMany({
        where,
        take: per_page,
        skip,
        orderBy:
          sortField === 'lastName' || sortField === 'name'
            ? [
                { student: { person: { lastName: orderBy } } },
                { student: { person: { name: orderBy } } },
              ]
            : { [sortField]: orderBy },
        select: studentMembershipSelect,
      }),
      this.prisma.studentMembership.count({ where }),
      this.prisma.studentCharge.findMany({
        where: {
          studentMembership: globalWhere,
          charge: {
            status: {
              not: 'CANCELLED',
            },
          },
        },
        select: {
          charge: {
            select: {
              amount: true,
              pendingAmount: true,
              adjustmentAmount: true,
            },
          },
        },
      }),
      this.prisma.studentMembership.count({
        where: { ...globalWhere, status: 'ACTIVE' },
      }),
      this.prisma.studentMembership.count({
        where: { ...globalWhere, status: 'SUSPENDED' },
      }),
      this.prisma.studentMembership.count({
        where: { ...globalWhere, status: 'PENDING_ACTIVE' },
      }),
      courseSeasonId
        ? this.prisma.courseSeasonShift
            .aggregate({
              where: { courseSeasonId },
              _sum: { maxMembers: true },
            })
            .then((res) => ({ maxMembers: res._sum.maxMembers }))
        : Promise.resolve(null),
    ]);

    const globalTotalBilled = Number(
      allCharges
        .reduce((sum, mc) => sum + (Number(mc.charge.amount) || 0), 0)
        .toFixed(2),
    );
    const globalTotalPending = Number(
      allCharges
        .reduce((sum, mc) => sum + (Number(mc.charge.pendingAmount) || 0), 0)
        .toFixed(2),
    );
    const globalTotalPaid = Number(
      allCharges
        .reduce(
          (sum, mc) =>
            sum +
            (Number(mc.charge.amount) -
              (Number(mc.charge.pendingAmount) || 0) -
              (Number(mc.charge.adjustmentAmount) || 0)),
          0,
        )
        .toFixed(2),
    );
    const totalPages = Math.ceil(totalItems / per_page);
    const currentPage = page;

    return {
      message: 'Inscripciones escolares obtenidas exitosamente',
      data: studentMemberships.map(mapMembershipWithTotal),
      summary: {
        totalBilled: globalTotalBilled,
        totalPaid: globalTotalPaid,
        totalPending: globalTotalPending,
        activeMembers: activeMembersCount,
        suspendedMembers: suspendedMembersCount,
        pendingMembers: pendingActiveMembersCount,
        occupiedSlotsCount:
          activeMembersCount +
          suspendedMembersCount +
          pendingActiveMembersCount,
        maxMembers: courseSeasonData?.maxMembers || null,
      },
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
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
      data: mapMembershipWithTotal(membership),
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
      this.getCourseMembershipOfferingAndShift(
        offeringId,
        updateDto.courseSeasonShiftId ?? membership.courseSeasonShiftId,
      ),
    ]);

    this.validateMembershipStartDate(
      updateDto.startedAt
        ? new Date(updateDto.startedAt)
        : membership.startedAt,
      offering.courseSeason.season.startDate,
      offering.courseSeason.season.endDate,
    );

    this.validateStudentEligibility(student, offering.shift);

    const isChangingOffering =
      updateDto.courseSeasonId &&
      updateDto.courseSeasonId !== membership.courseSeasonId;

    if (isChangingOffering) {
      await this.validateOfferingCapacity(
        offering.shift.id,
        offering.shift.maxMembers,
      );
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
      // this.studentChargesService
      //   .recalculatePendingFutureCharges(id)
      //   .catch((e) => {
      //     this.logger.error(
      //       `Error al recalcular cargos tras cambio de plan en membresía de estudiante ${id}`,
      //       e.stack,
      //     );
      //   });
    }

    return {
      message: 'Inscripción escolar actualizada exitosamente',
      data: mapMembershipWithTotal(updatedMembership),
    };
  }

  async finish(id: string, reason: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.FINISHED) {
      throw new BadRequestException('La membresía ya se encuentra finalizada');
    }

    if (membership.status === StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException(
        'La membresía se encuentra suspendida y no puede ser finalizada',
      );
    }

    if (membership.status === StudentMembershipStatus.WITHDRAWN) {
      throw new BadRequestException(
        'La membresía se encuentra retirada y no puede ser finalizada',
      );
    }

    const finishedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.FINISHED,
        endedAt: new Date(),
        notes: reason,
        histories: {
          create: {
            previousStatus: membership.status,
            newStatus: StudentMembershipStatus.FINISHED,
            reason,
          },
        },
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar finalizada exitosamente',
      data: mapMembershipWithTotal(finishedMembership),
    };
  }

  async suspend(id: string, reason: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.FINISHED) {
      throw new BadRequestException(
        'La membresía se encuentra finalizada y no puede ser suspendida',
      );
    }

    if (membership.status === StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException('La membresía ya se encuentra suspendida');
    }

    if (membership.status === StudentMembershipStatus.WITHDRAWN) {
      throw new BadRequestException(
        'La membresía se encuentra retirada y no puede ser suspendida',
      );
    }

    const suspendedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.SUSPENDED,
        notes: reason,
        histories: {
          create: {
            previousStatus: membership.status,
            newStatus: StudentMembershipStatus.SUSPENDED,
            reason,
          },
        },
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar suspendida exitosamente',
      data: mapMembershipWithTotal(suspendedMembership),
    };
  }

  async withdraw(id: string, reason: string) {
    const membership = await this.getMembership(id);

    if (membership.status === StudentMembershipStatus.FINISHED) {
      throw new BadRequestException(
        'La membresía se encuentra finalizada y no puede ser retirada',
      );
    }

    if (membership.status === StudentMembershipStatus.WITHDRAWN) {
      throw new BadRequestException('La membresía ya se encuentra retirada');
    }

    const withdrawnMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.WITHDRAWN,
        endedAt: new Date(),
        notes: reason,
        histories: {
          create: {
            previousStatus: membership.status,
            newStatus: StudentMembershipStatus.WITHDRAWN,
            reason,
          },
        },
      },
      select: studentMembershipSelect,
    });

    const pendingCharges = await this.prisma.studentCharge.findMany({
      where: {
        studentMembershipId: id,
        charge: { status: StatusCharge.PENDING },
      },
      select: {
        chargeId: true,
        charge: {
          select: { description: true },
        },
      },
    });

    if (pendingCharges.length > 0) {
      const cancelReason = reason
        ? `(Cancelado por retiro: ${reason})`
        : '(Cancelado por retiro de inscripción)';

      const updatePromises = pendingCharges.map((pc) => {
        const newDescription = pc.charge.description
          ? `${pc.charge.description} ${cancelReason}`
          : cancelReason;

        return this.prisma.charge.update({
          where: { id: pc.chargeId },
          data: {
            status: StatusCharge.CANCELLED,
            description: newDescription,
          },
        });
      });

      await Promise.all(updatePromises);
    }

    return {
      message: 'Inscripción escolar retirada exitosamente',
      data: mapMembershipWithTotal(withdrawnMembership),
    };
  }

  async reactivate(id: string, reason: string) {
    const membership = await this.getMembership(id);

    if (membership.status !== StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException(
        'Solo una membresía suspendida puede reactivarse',
      );
    }

    const updatedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.ACTIVE,
        notes: reason,
        histories: {
          create: {
            previousStatus: membership.status,
            newStatus: StudentMembershipStatus.ACTIVE,
            reason,
          },
        },
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción escolar reactivada exitosamente',
      data: mapMembershipWithTotal(updatedMembership),
    };
  }

  async reenter(
    id: string,
    reenterDto: ReenterStudentMembershipDto,
    currentUser?: { id: string },
  ) {
    const effectiveDate = new Date(reenterDto.effectiveDate);
    if (isNaN(effectiveDate.getTime())) {
      throw new BadRequestException('Fecha efectiva de reingreso inválida.');
    }

    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Obtener la membresía con todas sus relaciones necesarias
        const membership = await tx.studentMembership.findUnique({
          where: { id },
          include: {
            student: { include: { person: true } },
            courseSeason: {
              include: {
                season: true,
                course: true,
              },
            },
            courseSeasonShift: {
              include: { shift: true },
            },
            histories: {
              orderBy: { createdAt: 'desc' },
            },
            cycleEnrollments: {
              orderBy: { cycleStartDate: 'desc' },
              include: { charge: true },
            },
          },
        });

        if (!membership) {
          throw new NotFoundException('Inscripción de estudiante no encontrada');
        }

        // 2. Validar que el estado sea estrictamente WITHDRAWN
        if (membership.status !== StudentMembershipStatus.WITHDRAWN) {
          throw new BadRequestException(
            `Solo una membresía con estado WITHDRAWN puede ser reingresada. El estado actual es ${membership.status}.`,
          );
        }

        // 3. Validar estado y fechas de CourseSeason
        if (membership.courseSeason.status !== StatusCourseSeason.ACTIVE) {
          throw new BadRequestException('El curso no se encuentra activo');
        }

        // 3.1. Validar que la fecha efectiva no sea futura respecto al momento de la operación
        const now = new Date();
        if (effectiveDate.getTime() > now.getTime()) {
          throw new BadRequestException(
            `La fecha efectiva de reingreso no puede ser una fecha futura (${effectiveDate.toISOString()}) respecto al momento de la operación.`,
          );
        }

        // 3.2. Validar que la fecha esté dentro del rango de la temporada
        const seasonStart = new Date(membership.courseSeason.season.startDate);
        const seasonEnd = new Date(membership.courseSeason.season.endDate);
        if (effectiveDate < seasonStart || effectiveDate > seasonEnd) {
          throw new BadRequestException(
            `La fecha de reingreso (${effectiveDate.toISOString().split('T')[0]}) debe estar dentro del rango de la temporada (${seasonStart.toISOString().split('T')[0]} a ${seasonEnd.toISOString().split('T')[0]}).`,
          );
        }

        // 3.3. Obtener la fecha de la última baja a partir de los registros históricos reales y endedAt
        const lastWithdrawalHistory = membership.histories?.find(
          (h) => h.newStatus === StudentMembershipStatus.WITHDRAWN,
        );
        const historyWithdrawalDate = lastWithdrawalHistory
          ? new Date(lastWithdrawalHistory.createdAt)
          : null;
        const endedAtDate = membership.endedAt
          ? new Date(membership.endedAt)
          : null;

        let lastWithdrawalDate: Date | null = null;
        if (endedAtDate && historyWithdrawalDate) {
          lastWithdrawalDate =
            endedAtDate.getTime() >= historyWithdrawalDate.getTime()
              ? endedAtDate
              : historyWithdrawalDate;
        } else {
          lastWithdrawalDate = endedAtDate || historyWithdrawalDate;
        }

        // 3.4. Validar que la fecha efectiva sea estrictamente posterior a la última baja registrada
        if (lastWithdrawalDate) {
          if (effectiveDate.getTime() <= lastWithdrawalDate.getTime()) {
            throw new BadRequestException(
              `La fecha efectiva de reingreso (${effectiveDate.toISOString()}) debe ser posterior a la última baja registrada (${lastWithdrawalDate.toISOString()}).`,
            );
          }
        }

        // 4. Bloquear y serializar concurrencia mediante SELECT ... FOR UPDATE sobre CourseSeason
        await tx.$queryRaw`
          SELECT 1 
          FROM course_seasons 
          WHERE id = ${membership.courseSeasonId} 
          FOR UPDATE
        `;

        // 5. REGLA DE UNICIDAD Y DUPLICADOS HISTÓRICOS:
        // Bloquear si ya existe OTRA membresía para este alumno en este curso que esté ACTIVE, PENDING_ACTIVE o SUSPENDED
        const activeDuplicate = await tx.studentMembership.findFirst({
          where: {
            studentId: membership.studentId,
            courseSeasonId: membership.courseSeasonId,
            id: { not: id },
            status: {
              in: [
                StudentMembershipStatus.ACTIVE,
                StudentMembershipStatus.PENDING_ACTIVE,
                StudentMembershipStatus.SUSPENDED,
              ],
            },
          },
          include: {
            courseSeasonShift: { include: { shift: true } },
          },
        });

        if (activeDuplicate) {
          throw new BadRequestException(
            `No es posible reactivar esta membresía porque el estudiante ya cuenta con una membresía vigente (Estado: ${activeDuplicate.status}, ID: ${activeDuplicate.id}, Turno: "${activeDuplicate.courseSeasonShift?.shift?.name || 'N/A'}") en este curso. Debe gestionar su participación en su expediente activo.`,
          );
        }

        // Verificar si existen múltiples WITHDRAWN históricas:
        // Si existen múltiples WITHDRAWN sin ninguna activa, exigir que la reactivación se realice sobre la más reciente
        const allWithdrawn = await tx.studentMembership.findMany({
          where: {
            studentId: membership.studentId,
            courseSeasonId: membership.courseSeasonId,
            status: StudentMembershipStatus.WITHDRAWN,
          },
          orderBy: [
            { endedAt: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        if (allWithdrawn.length > 1 && allWithdrawn[0].id !== id) {
          throw new BadRequestException(
            `El estudiante posee múltiples expedientes retirados en este curso. Por seguridad administrativa, el reingreso debe realizarse sobre el expediente más reciente (ID: ${allWithdrawn[0].id}).`,
          );
        }

        // 6. Turno destino y validaciones de elegibilidad y cupos
        const targetShiftId =
          reenterDto.courseSeasonShiftId || membership.courseSeasonShiftId;

        const targetShift = await tx.courseSeasonShift.findUnique({
          where: { id: targetShiftId },
          include: {
            shift: true,
            category: true,
            courseSeason: { include: { season: true } },
          },
        });

        if (!targetShift) {
          throw new NotFoundException('El turno seleccionado no fue encontrado');
        }

        if (targetShift.courseSeasonId !== membership.courseSeasonId) {
          throw new BadRequestException(
            'El turno seleccionado no pertenece al mismo curso',
          );
        }

        if (!targetShift.isActive) {
          throw new BadRequestException('El turno seleccionado no está activo');
        }

        // Validar elegibilidad de edad y género para el turno
        this.validateStudentEligibility(membership.student as any, targetShift as any);

        // Bloquear el turno para validar cupo concurrentemente
        await tx.$queryRaw`
          SELECT 1 
          FROM course_season_shifts 
          WHERE id = ${targetShiftId} 
          FOR UPDATE
        `;

        // Validar cupos en el turno
        await this.validateOfferingCapacity(targetShiftId, targetShift.maxMembers);

        // 7. Actualizar la membresía preservando su ID y antecedentes históricos
        // startedAt permanece inmutable como la fecha original de ingreso.
        // endedAt se limpia a null porque el estudiante vuelve a estar activo.
        // reenteredAt se actualiza a la nueva fecha efectiva.
        const notesToAppend = reenterDto.notes
          ? `${membership.notes ? membership.notes + ' | ' : ''}Reingreso: ${reenterDto.reason} (${reenterDto.notes})`
          : `${membership.notes ? membership.notes + ' | ' : ''}Reingreso: ${reenterDto.reason}`;

        const updatedMembership = await tx.studentMembership.update({
          where: { id },
          data: {
            status: StudentMembershipStatus.ACTIVE,
            courseSeasonShiftId: targetShiftId,
            endedAt: null,
            reenteredAt: effectiveDate,
            notes: notesToAppend,
            ...(currentUser?.id && { updatedById: currentUser.id }),
            histories: {
              create: {
                previousStatus: StudentMembershipStatus.WITHDRAWN,
                newStatus: StudentMembershipStatus.ACTIVE,
                reason: reenterDto.reason,
                effectiveDate: effectiveDate,
                ...(currentUser?.id && { createdById: currentUser.id }),
              },
            },
          },
          select: studentMembershipSelect,
        });

        return {
          message:
            'Reingreso de estudiante a curso escolar procesado exitosamente',
          data: mapMembershipWithTotal(updatedMembership),
        };
      },
      { timeout: 15000 },
    );
  }

  async getReenterContext(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
      include: {
        student: { include: { person: true } },
        courseSeason: {
          include: {
            season: true,
            course: true,
            shifts: {
              where: { isActive: true },
              include: { shift: true, category: true },
            },
          },
        },
        courseSeasonShift: {
          include: { shift: true, category: true },
        },
        histories: {
          where: { newStatus: StudentMembershipStatus.WITHDRAWN },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        cycleEnrollments: {
          orderBy: { cycleStartDate: 'desc' },
          include: {
            charge: {
              select: {
                id: true,
                status: true,
                amount: true,
                pendingAmount: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Inscripción de estudiante no encontrada');
    }

    const lastWithdrawalHistory = membership.histories?.[0];
    const withdrawalDate = membership.endedAt || lastWithdrawalHistory?.createdAt || null;
    const withdrawalReason = lastWithdrawalHistory?.reason || membership.notes || 'Baja administrativa';

    // Obtener ocupación de los turnos disponibles
    const shiftsWithCapacity = await Promise.all(
      membership.courseSeason.shifts.map(async (s) => {
        const activeMembers = await this.prisma.studentMembership.count({
          where: {
            courseSeasonShiftId: s.id,
            status: { in: [StudentMembershipStatus.ACTIVE, StudentMembershipStatus.SUSPENDED] },
          },
        });
        const max = s.maxMembers ?? 0;
        return {
          id: s.id,
          name: s.shift?.name || 'Turno',
          categoryName: s.category?.name || 'General',
          gender: s.gender,
          maxMembers: max,
          currentMembers: activeMembers,
          availableSpots: Math.max(0, max - activeMembers),
          isCurrentShift: s.id === membership.courseSeasonShiftId,
        };
      }),
    );

    const confirmedCycles = membership.cycleEnrollments.filter(c => c.status === 'CONFIRMED');
    const cancelledCycles = membership.cycleEnrollments.filter(c => c.status === 'CANCELLED');
    const pendingCycles = membership.cycleEnrollments.filter(c => c.status === 'PENDING');

    return {
      membershipId: membership.id,
      status: membership.status,
      startedAt: membership.startedAt,
      endedAt: membership.endedAt,
      reenteredAt: membership.reenteredAt,
      withdrawalDate,
      withdrawalReason,
      student: {
        id: membership.student.id,
        firstName: membership.student.person.name,
        lastName: `${membership.student.person.lastName} ${membership.student.person.secondLastName || ''}`.trim(),
        documentNumber: membership.student.person.documentNumber,
        birthDate: membership.student.person.birthDate,
      },
      courseSeason: {
        id: membership.courseSeason.id,
        courseName: membership.courseSeason.course.name,
        seasonName: membership.courseSeason.season.name,
        startDate: membership.courseSeason.season.startDate,
        endDate: membership.courseSeason.season.endDate,
        status: membership.courseSeason.status,
      },
      currentShift: {
        id: membership.courseSeasonShift.id,
        name: membership.courseSeasonShift.shift.name,
      },
      availableShifts: shiftsWithCapacity,
      cyclesSummary: {
        total: membership.cycleEnrollments.length,
        confirmed: confirmedCycles.length,
        cancelled: cancelledCycles.length,
        pending: pendingCycles.length,
        recentCycles: membership.cycleEnrollments.slice(0, 5).map(c => ({
          id: c.id,
          cycleStartDate: c.cycleStartDate,
          cycleEndDate: c.cycleEndDate,
          status: c.status,
          attempt: c.attempt,
          chargeStatus: c.charge?.status || null,
          chargeAmount: c.charge?.amount || null,
        })),
      },
    };
  }

  async activate(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status !== StudentMembershipStatus.PENDING_ACTIVE) {
      throw new BadRequestException(
        'Solo una membresía pendiente puede ser activada',
      );
    }

    const offering = await this.getCourseMembershipOfferingAndShift(
      membership.courseSeasonId,
      membership.courseSeasonShiftId,
    );

    await this.validateOfferingCapacity(
      offering.shift.id,
      offering.shift.maxMembers,
    );

    const updatedMembership = await this.prisma.studentMembership.update({
      where: { id },
      data: {
        status: StudentMembershipStatus.ACTIVE,
        notes: reason,
        histories: {
          create: {
            previousStatus: membership.status,
            newStatus: StudentMembershipStatus.ACTIVE,
            reason,
          },
        },
      },
      select: studentMembershipSelect,
    });

    return {
      message: 'Inscripción activada exitosamente',
      data: mapMembershipWithTotal(updatedMembership),
    };
  }

  async remove(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
      include: {
        studentCharges: {
          include: {
            charge: {
              include: {
                payments: true,
                childCharges: {
                  include: { payments: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        'La membresía de estudiante no fue encontrada',
      );
    }

    // Validar que no hayan pagos vinculados (incluso cancelados) ya que bloquean el borrado por constraints de DB
    const hasTransactionsOrPaid = membership.studentCharges.some(
      (mc) =>
        mc.charge.payments.length > 0 ||
        mc.charge.childCharges.some((cc) => cc.payments.length > 0),
    );

    if (hasTransactionsOrPaid) {
      throw new BadRequestException(
        'No se puede eliminar la membresía porque tiene historial financiero (cargos modificados, intentos de pago o cargos anidados). Para mantener la integridad contable, utilice la opción de Finalizar o Retirar en su lugar.',
      );
    }

    // Si llegamos aquí, es 100% seguro eliminar la membresía y limpiar el historial y los cargos.
    const chargeIds = membership.studentCharges.map((mc) => mc.chargeId);
    const childChargeIds = membership.studentCharges.flatMap((mc) =>
      mc.charge.childCharges.map((cc) => cc.id),
    );

    await this.prisma.$transaction([
      // 1. Borrar historial de pausas
      this.prisma.studentMembershipPause.deleteMany({
        where: { studentMembershipId: id },
      }),
      // 2. Borrar historial de estados de membresía
      this.prisma.studentMembershipHistory.deleteMany({
        where: { studentMembershipId: id },
      }),
      // 3. Borrar descuentos asociados
      this.prisma.studentDiscount.deleteMany({
        where: { studentMembershipId: id },
      }),
      // 4. Borrar enrollments a los ciclos (si los hubiera)
      this.prisma.cycleEnrollment.deleteMany({
        where: { studentMembershipId: id },
      }),
      // 5. Borrar la tabla pivote de cargos
      this.prisma.studentCharge.deleteMany({
        where: { studentMembershipId: id },
      }),
      // 6. Borrar cargos hijos (moras, etc)
      ...(childChargeIds.length > 0
        ? [
            this.prisma.charge.deleteMany({
              where: { id: { in: childChargeIds } },
            }),
          ]
        : []),
      // 7. Borrar los cargos reales vinculados a la membresía (ya no tendrán referencias)
      this.prisma.charge.deleteMany({
        where: { id: { in: chargeIds } },
      }),
      // 6. Finalmente, borrar la membresía
      this.prisma.studentMembership.delete({
        where: { id },
      }),
    ]);

    return {
      message: 'Membresía eliminada de forma permanente y segura',
      data: null,
    };
  }

  async transferShift(id: string, transferDto: TransferShiftDto) {
    return await this.prisma.$transaction(
      async (tx) => {
        // 1. Obtener y bloquear la membresía y sus ciclos futuros
        const membership = await tx.studentMembership.findUnique({
          where: { id },
          include: {
            courseSeason: {
              include: { course: true },
            },
            courseSeasonShift: {
              include: { shift: true },
            },
            cycleEnrollments: {
              where: {
                status: { in: ['PENDING', 'CONFIRMED'] },
              },
              orderBy: { cycleStartDate: 'asc' },
            },
          },
        });

        if (!membership) {
          throw new NotFoundException('errors.MEMBERSHIP_NOT_FOUND');
        }

        if (
          membership.status !== StudentMembershipStatus.ACTIVE &&
          membership.status !== StudentMembershipStatus.PENDING_ACTIVE
        ) {
          throw new BadRequestException(
            'Solo las inscripciones activas pueden ser transferidas',
          );
        }

        if (
          membership.courseSeasonShiftId ===
          transferDto.targetCourseSeasonShiftId
        ) {
          throw new BadRequestException(
            'El estudiante ya se encuentra en este turno',
          );
        }

        // 2. Bloquear y validar destino
        const targetCourseSeasonShift = await tx.courseSeasonShift.findUnique({
          where: { id: transferDto.targetCourseSeasonShiftId },
          include: { shift: true, courseSeason: { include: { course: true } } },
        });

        if (!targetCourseSeasonShift) {
          throw new NotFoundException('El turno destino no fue encontrado');
        }

        const targetCourseSeason = targetCourseSeasonShift.courseSeason;

        if (targetCourseSeason.status !== StatusCourseSeason.ACTIVE) {
          throw new BadRequestException('El turno destino no está activo');
        }

        // Validar que ambos turnos pertenezcan al mismo curso (regla de negocio)
        if (membership.courseSeason.courseId !== targetCourseSeason.courseId) {
          throw new BadRequestException(
            'Solo se pueden realizar transferencias entre turnos del mismo curso',
          );
        }

        const isSameOffer =
          membership.courseSeasonId === transferDto.targetCourseSeasonId;

        // 3. Determinar los ciclos transferibles (ciclo activo en curso + ciclos futuros)
        // Regla crítica: cycleEndDate <= effectiveDate es histórico y JAMÁS debe modificarse.
        const effectiveDate = new Date(transferDto.effectiveDate);

        const cyclesToTransfer = membership.cycleEnrollments.filter(
          (c) => c.cycleEndDate > effectiveDate,
        );

        const transferStartDate = effectiveDate;

        if (cyclesToTransfer.length === 0) {
          // Si no hay ciclos futuros, de todas formas cambiamos el turno base
          // para que las próximas facturaciones (cron) se generen en el nuevo turno.
          this.logger.log(
            `No hay ciclos futuros para transferir en membresía ${id}, solo se actualizará el turno base.`,
          );
        } else {
          // 4. Validar capacidad para cada ciclo a transferir
          for (const cycle of cyclesToTransfer) {
            await validateCourseSeasonCapacity(
              tx,
              transferDto.targetCourseSeasonShiftId,
              cycle.cycleStartDate,
              cycle.cycleEndDate,
              cycle.id,
            );
          }

          // 5. Actualizar los ciclos futuros al nuevo turno
          await tx.cycleEnrollment.updateMany({
            where: {
              id: { in: cyclesToTransfer.map((c) => c.id) },
            },
            data: {
              courseSeasonId: transferDto.targetCourseSeasonId,
              courseSeasonShiftId: transferDto.targetCourseSeasonShiftId,
            },
          });
        }

        // 6. Actualizar el contrato base (StudentMembership)
        const updatedMembership = await tx.studentMembership.update({
          where: { id },
          data: {
            courseSeasonId: transferDto.targetCourseSeasonId,
            courseSeasonShiftId: transferDto.targetCourseSeasonShiftId,
            histories: {
              create: {
                previousStatus: membership.status,
                newStatus: membership.status,
                reason: `Transferencia de turno de ${membership.courseSeasonShift?.shift?.name || 'Origen'} a ${targetCourseSeasonShift.shift.name || 'Destino'} a partir del ${transferStartDate.toLocaleDateString()}`,
              },
            },
          },
          select: studentMembershipSelect,
        });

        return {
          message: 'Transferencia de turno procesada exitosamente',
          data: mapMembershipWithTotal(updatedMembership),
        };
      },
      { timeout: 15000 },
    );
  }

  async getMembershipHistories(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException('La inscripción no fue encontrada');
    }

    const histories = await this.prisma.studentMembershipHistory.findMany({
      where: { studentMembershipId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        previousStatus: true,
        newStatus: true,
        reason: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            person: {
              select: {
                name: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return histories;
  }

  private async getMembership(id: string) {
    const membership = await this.prisma.studentMembership.findUnique({
      where: { id },
    });
    if (!membership) {
      throw new NotFoundException('La inscripción no fue encontrada');
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
      throw new BadRequestException('El plan de pago no fue encontrado');
    }
    if (paymentPlan.courseSeasonId !== courseSeasonId) {
      throw new BadRequestException(
        'El plan de pago no pertenece al curso seleccionado',
      );
    }
  }

  private async getStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { person: true },
    });
    if (!student) {
      throw new NotFoundException('El estudiante no fue encontrado');
    }
    return student;
  }

  /**
   * Cancelación canónica de un ciclo (manual o automática por cron).
   * Neutraliza el cargo a CANCELLED (pendingAmount: 0), libera el cupo y preserva auditoría.
   */
  async cancelCycleEnrollment(
    cycleEnrollmentId: string,
    reason: string,
    user?: any,
    options?: { isCron?: boolean },
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('El motivo de cancelación es obligatorio y debe tener al menos 5 caracteres.');
    }

    return await this.prisma.$transaction(
      async (tx) => {
        const cycle = await tx.cycleEnrollment.findUnique({
          where: { id: cycleEnrollmentId },
          include: {
            charge: {
              include: {
                payments: true,
              },
            },
            studentMembership: {
              include: {
                student: {
                  include: {
                    person: true,
                  },
                },
              },
            },
          },
        });

        if (!cycle) {
          throw new NotFoundException(`Ciclo con ID ${cycleEnrollmentId} no encontrado`);
        }

        // Idempotencia: si ya está cancelado, retornar sin error
        if (cycle.status === CycleEnrollmentStatus.CANCELLED) {
          return {
            id: cycle.id,
            status: cycle.status,
            message: 'El ciclo ya se encontraba cancelado previamente.',
          };
        }

        // Solo permitir cancelar PENDING en esta fase
        if (cycle.status !== CycleEnrollmentStatus.PENDING) {
          throw new BadRequestException('Solo se pueden cancelar ciclos que se encuentren en estado pendiente.');
        }

        // Validar JIT de expiración si es llamado por cron
        if (options?.isCron && !isCycleEnrollmentExpired(cycle.createdAt)) {
          return {
            id: cycle.id,
            status: cycle.status,
            message: 'El ciclo aún no ha superado el plazo de reserva (72h).',
          };
        }

        // Verificar si tiene asistencias registradas
        const attendedBookings = await tx.sessionBooking.count({
          where: {
            studentId: cycle.studentMembership.studentId,
            attended: true,
            session: {
              event: {
                startDate: {
                  gte: cycle.cycleStartDate,
                  lte: cycle.cycleEndDate,
                },
              },
            },
          },
        });

        if (attendedBookings > 0) {
          throw new BadRequestException(
            'No se puede cancelar el ciclo porque el estudiante ya cuenta con asistencias registradas en dicho período.',
          );
        }

        // Validar e interactuar con el Charge
        if (cycle.chargeId) {
          // Bloqueo pesimista a nivel de fila (FOR UPDATE)
          await lockChargeForUpdate(tx, cycle.chargeId);

          // Re-obtener el cargo con payments bloqueados
          const charge = await tx.charge.findUnique({
            where: { id: cycle.chargeId },
            include: { payments: true },
          });

          if (!charge) {
            throw new NotFoundException(`Cargo con ID ${cycle.chargeId} no encontrado`);
          }

          // Bloquear si tiene pagos completados o en proceso
          const activePayments = (charge.payments || []).filter(
            (p) => p.status === 'COMPLETED' || p.status === 'PENDING',
          );

          if (activePayments.length > 0) {
            throw new BadRequestException(
              'No se puede cancelar el ciclo porque el cargo asociado cuenta con pagos completados o en proceso.',
            );
          }

          if (charge.status === StatusCharge.PAID || charge.status === StatusCharge.PARTIAL) {
            throw new BadRequestException(
              'No se puede cancelar el ciclo porque el cargo asociado ya ha recibido pagos.',
            );
          }

          // Neutralizar el cargo
          await tx.charge.update({
            where: { id: charge.id },
            data: {
              status: StatusCharge.CANCELLED,
              pendingAmount: new Prisma.Decimal(0),
              adjustmentReason: `Cancelado: ${reason}`,
              updatedById: user?.id || null,
            },
          });
        }

        // Cancelar el CycleEnrollment (el motor de cupos dinámico libera la plaza inmediatamente)
        const updatedEnrollment = await tx.cycleEnrollment.update({
          where: { id: cycle.id },
          data: {
            status: CycleEnrollmentStatus.CANCELLED,
            cancellationReason: reason,
            cancelledAt: new Date(),
            updatedById: user?.id || null,
          },
        });

        this.logger.log(
          `Ciclo ${cycle.id} cancelado exitosamente por ${user?.id ? `usuario ${user.id}` : 'SYSTEM/CRON'}. Motivo: ${reason}`,
        );

        return {
          id: updatedEnrollment.id,
          status: updatedEnrollment.status,
          chargeId: cycle.chargeId,
          message: 'Ciclo cancelado exitosamente. Cupo liberado y deuda neutralizada.',
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async cancelExpiredPendingCycle(cycleEnrollmentId: string) {
    return await this.cancelCycleEnrollment(
      cycleEnrollmentId,
      'Cancelado automáticamente por vencimiento de plazo (72h)',
      null,
      { isCron: true },
    );
  }

  private async getCourseMembershipOfferingAndShift(
    courseSeasonId: string,
    courseSeasonShiftId: string,
  ) {
    const shift = await this.prisma.courseSeasonShift.findUnique({
      where: { id: courseSeasonShiftId },
      include: {
        category: {
          select: { minAge: true, maxAge: true },
        },
        courseSeason: {
          include: {
            season: {
              select: { startDate: true, endDate: true },
            },
          },
        },
      },
    });
    if (!shift || shift.courseSeasonId !== courseSeasonId) {
      throw new NotFoundException(
        'El turno o la temporada de curso no fue encontrada',
      );
    }
    return {
      shift: shift as unknown as CourseSeasonShiftWithEligibility,
      courseSeason: shift.courseSeason,
    };
  }

  private async validateOfferingCapacity(
    courseSeasonShiftId: string,
    maxMembers: number | null,
  ) {
    if (maxMembers === null) return;

    const activeMembers = await this.prisma.studentMembership.count({
      where: {
        courseSeasonShiftId,
        status: {
          in: [
            StudentMembershipStatus.ACTIVE,
            StudentMembershipStatus.SUSPENDED,
          ],
        },
      },
    });

    if (activeMembers >= maxMembers) {
      throw new BadRequestException(
        'El curso ya alcanzó el número máximo de miembros',
      );
    }
  }

  private async validateDuplicateMembership(
    studentId: string,
    courseSeasonId: string,
    currentMembershipId?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const existingMembership = await tx.studentMembership.findFirst({
      where: {
        studentId,
        courseSeasonId,
        ...(currentMembershipId && {
          NOT: { id: currentMembershipId },
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        courseSeasonShift: {
          include: {
            shift: true,
          },
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === StudentMembershipStatus.ACTIVE) {
        throw new BadRequestException(
          `El estudiante ya cuenta con una inscripción activa en este curso, asignado al turno "${existingMembership.courseSeasonShift?.shift?.name || 'N/A'}". Si deseas cambiarlo de horario, utiliza la opción de Transferencia en su membresía actual.`,
        );
      } else if (existingMembership.status === StudentMembershipStatus.PENDING_ACTIVE) {
        throw new BadRequestException(
          `El estudiante ya cuenta con una inscripción pendiente de activación en este curso, asignado al turno "${existingMembership.courseSeasonShift?.shift?.name || 'N/A'}".`,
        );
      } else if (existingMembership.status === StudentMembershipStatus.SUSPENDED) {
        throw new BadRequestException(
          `El estudiante se encuentra actualmente suspendido en este curso (Turno: "${existingMembership.courseSeasonShift?.shift?.name || 'N/A'}"). Debe reactivar la membresía suspendida en lugar de crear una nueva.`,
        );
      } else if (existingMembership.status === StudentMembershipStatus.WITHDRAWN) {
        throw new BadRequestException(
          `El estudiante cuenta con un expediente previo dado de baja en este curso (ID: ${existingMembership.id}). Para volver a inscribirlo, utilice la acción «Registrar reingreso» sobre su membresía retirada en lugar de crear una nueva inscripción.`,
        );
      } else if (existingMembership.status === StudentMembershipStatus.FINISHED) {
        throw new BadRequestException(
          `El estudiante ya cuenta con una inscripción finalizada en este curso durante la temporada actual.`,
        );
      }
    }
  }

  private validateStudentEligibility(
    student: StudentWithPerson,
    shift: CourseSeasonShiftWithEligibility,
  ) {
    if (!student.isActive) {
      throw new BadRequestException(
        'El estudiante se encuentra inactivo y no puede ser inscrito en cursos',
      );
    }

    if (shift.validateAge) {
      if (!student.person.birthDate) {
        throw new BadRequestException(
          'El estudiante no tiene fecha de nacimiento registrada, por lo que no es posible validar su edad para este turno.',
        );
      }

      if (shift.minBirthYear || shift.maxBirthYear) {
        const birthYear = student.person.birthDate.getFullYear();
        if (shift.maxBirthYear && birthYear > shift.maxBirthYear) {
          throw new BadRequestException(
            `El año de nacimiento del estudiante (${birthYear}) supera el año máximo permitido (${shift.maxBirthYear}) para este turno.`,
          );
        }
        if (shift.minBirthYear && birthYear < shift.minBirthYear) {
          throw new BadRequestException(
            `El año de nacimiento del estudiante (${birthYear}) es inferior al año mínimo permitido (${shift.minBirthYear}) para este turno.`,
          );
        }
      } else {
        this.validateStudentAge(
          student.person.birthDate,
          shift.courseSeason.season.startDate,
          shift.category.minAge,
          shift.category.maxAge,
        );
      }
    }

    if (shift.gender !== 'MIXED' && shift.gender !== student.person.gender) {
      throw new BadRequestException(
        'El género del estudiante no coincide con el género requerido para este turno',
      );
    }
  }

  private validateMembershipStartDate(
    startedAt: Date,
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    const sStart = new Date(seasonStartDate);
    sStart.setUTCHours(0, 0, 0, 0);

    const sEnd = new Date(seasonEndDate);
    sEnd.setUTCHours(23, 59, 59, 999);

    if (startedAt < sStart || startedAt > sEnd) {
      const sent = startedAt.toISOString().split('T')[0];
      const start = seasonStartDate.toISOString().split('T')[0];
      const end = seasonEndDate.toISOString().split('T')[0];
      throw new BadRequestException(
        `La fecha de inicio enviada (${sent}) está fuera del rango permitido. Debe estar entre el ${start} y el ${end} (Fechas de la Temporada).`,
      );
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
    dto: CreateStudentMembershipPauseDto,
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
      const pStart = new Date(overlappingPause.startDate)
        .toISOString()
        .split('T')[0];
      const pEnd = new Date(overlappingPause.endDate)
        .toISOString()
        .split('T')[0];
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
          histories: {
            create: {
              previousStatus: membership.status,
              newStatus: 'SUSPENDED',
              reason: 'Creación de pausa activa',
            },
          },
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

  async getStudentsOptions(paginationDto: StudentsOptionsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      gender,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const searchTerms = search ? search.trim().split(/\s+/) : [];

    const where: Prisma.StudentWhereInput = {
      ...(searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { person: { name: { contains: term, mode: 'insensitive' } } },
                {
                  person: { lastName: { contains: term, mode: 'insensitive' } },
                },
                {
                  person: {
                    secondLastName: { contains: term, mode: 'insensitive' },
                  },
                },
                {
                  person: {
                    documentNumber: { contains: term, mode: 'insensitive' },
                  },
                },
              ],
            })),
          }
        : {}),
      isActive: true,
      ...(gender && { person: { gender } }),
    };

    const [persons, totalItems] = await Promise.all([
      this.prisma.student.findMany({
        where,
        take: per_page,
        skip,
        orderBy: [
          { person: { lastName: orderBy } },
          { person: { secondLastName: orderBy } },
          { person: { name: orderBy } },
        ],
        select: {
          id: true,
          isActive: true,
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
              secondLastName: true,
              documentNumber: true,
              gender: true,
              birthDate: true,
              imageUrl: true,
            },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / per_page);
    const currentPage = totalItems === 0 ? 0 : page;

    return {
      message: 'Estudiantes obtenidos exitosamente',
      data: persons.map((student) => ({
        ...student,
        person: {
          ...student.person,
          fullName: `${student.person.lastName || ''} ${student.person.secondLastName || ''} ${student.person.name}`.replace(/\s+/g, ' ').trim(),
        },
      })),
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async getCourseSeasonsOptions(paginationDto: PaginationDto) {
    const { per_page = 10, page = 1, search, orderBy = 'asc' } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.CourseSeasonWhereInput = {
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { season: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      status: StatusCourseSeason.ACTIVE,
      season: {
        endDate: {
          gte: new Date(),
        },
      },
    };

    const [courseSeasons, totalItems] = await Promise.all([
      this.prisma.courseSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { season: { name: orderBy } },
        select: {
          id: true,
          status: true,
          description: true,
          season: {
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
            },
          },
          imageUrl: true,
        },
      }),
      this.prisma.courseSeason.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / per_page);
    const currentPage = totalItems === 0 ? 0 : page;

    return {
      message: 'Temporadas obtenidas exitosamente',
      data: courseSeasons.map((courseSeason) => ({
        ...courseSeason,
        season: {
          ...courseSeason.season,
          fullName:
            `${courseSeason.season.name} ${courseSeason.season.startDate.toISOString().split('T')[0]} ${courseSeason.season.endDate.toISOString().split('T')[0] || ''}`.trim(),
        },
      })),
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }
}
