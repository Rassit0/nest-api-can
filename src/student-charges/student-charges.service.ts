import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentChargeDto } from './dto/create-student-charge.dto';
import { UpdateStudentChargeDto } from './dto/update-student-charge.dto';
import { PrismaService } from 'src/prisma.service';
import {
  Charge,
  StudentMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { StudentChargesPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

type StudentMembershipWithRelations = Prisma.StudentMembershipGetPayload<{
  include: {
    paymentPlan: true;
    studentDiscounts: true;
    courseSeason: {
      include: {
        season: true;
      };
    };
  };
}>;

const studentMembershipInclude = {
  paymentPlan: true,
  studentDiscounts: true,
  courseSeason: {
    include: {
      season: true,
    },
  },
} as const;

export const studentChargeSelect: Prisma.StudentChargeSelect = {
  id: true,
  studentMembershipId: true,
  chargeId: true,
  type: true,
  createdByCron: true,
  billingYear: true,
  billingMonth: true,
  createdAt: true,
  updatedAt: true,
  charge: {
    select: {
      id: true,
      description: true,
      amount: true,
      pendingAmount: true,
      dueDate: true,
      status: true,
    },
  },
  studentMembership: {
    select: {
      id: true,
      student: {
        select: {
          id: true,
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class StudentChargesService {
  private readonly logger = new Logger(StudentChargesService.name);

  private readonly MONTH_NAMES = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  constructor(private readonly prisma: PrismaService) {}

  // Aplicar cargos mensuales para alumnos
  async applyDailyStudentCharges() {
    this.logger.log(
      'Iniciando proceso diario de cálculo de cargos de estudiantes...',
    );

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Obtener membresías escolares activas/pendientes/suspendidas
    const memberships = await this.prisma.studentMembership.findMany({
      where: {
        status: {
          in: [
            StudentMembershipStatus.ACTIVE,
            StudentMembershipStatus.PENDING,
            StudentMembershipStatus.SUSPENDED,
          ],
        },
        OR: [
          { nextMonthlyChargeGenerationDate: { lte: today } },
          { nextMonthlyChargeGenerationDate: null },
        ],
        courseSeason: {
          season: {
            endDate: { gte: today },
          },
        },
      },
      include: studentMembershipInclude,
    });

    this.logger.log(
      `Se encontraron ${memberships.length} inscripciones de estudiantes activas o pendientes para procesar.`,
    );

    for (const membership of memberships) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.ensureStudentCharges(tx, membership, today);
        });
      } catch (error) {
        this.logger.error(
          `Error procesando cargos para el estudiante membresía ID ${membership.id}:`,
          error,
        );
      }
    }

    this.logger.log('Proceso de cargos de estudiantes finalizado.');
  }

  private async ensureStudentCharges(
    tx: Prisma.TransactionClient,
    membership: StudentMembershipWithRelations,
    today: Date,
  ) {
    await this.ensureRegistrationCharge(tx, membership);
    await this.ensureMonthlyCharges(tx, membership, today);
  }

  private async ensureRegistrationCharge(
    tx: Prisma.TransactionClient,
    membership: StudentMembershipWithRelations,
  ) {
    const exists = await tx.studentCharge.findUnique({
      where: {
        studentMembershipId_type_billingMonth_billingYear: {
          studentMembershipId: membership.id,
          type: TypeMembershipCharge.REGISTRATION,
          billingYear: membership.startedAt.getFullYear(),
          billingMonth: membership.startedAt.getMonth() + 1,
        },
      },
    });

    if (exists) return;

    const amount = this.calculateRegistrationFee(membership);
    if (amount <= 0) return;

    await this.createCharge(
      tx,
      membership.id,
      {
        description: 'Inscripción Escuela',
        amount,
        dueDate: membership.startedAt,
      },
      TypeMembershipCharge.REGISTRATION,
      membership.startedAt.getFullYear(),
      membership.startedAt.getMonth() + 1,
    );
  }

  private async ensureMonthlyCharges(
    tx: Prisma.TransactionClient,
    membership: StudentMembershipWithRelations,
    today: Date,
  ) {
    let generationDate = membership.nextMonthlyChargeGenerationDate;
    let currentBillingYear: number;
    let currentBillingMonth: number;

    if (generationDate) {
      const recoveredDueDate = new Date(generationDate);
      recoveredDueDate.setDate(
        recoveredDueDate.getDate() +
          membership.courseSeason.chargeGenerationDaysBefore,
      );
      currentBillingYear = recoveredDueDate.getFullYear();
      currentBillingMonth = recoveredDueDate.getMonth() + 1;
    } else {
      generationDate = new Date(membership.startedAt);
      currentBillingYear = membership.startedAt.getFullYear();
      currentBillingMonth = membership.startedAt.getMonth() + 1;
    }

    let nextPointer = membership.nextMonthlyChargeGenerationDate;
    const seasonEnd = new Date(membership.courseSeason.season.endDate);
    seasonEnd.setHours(23, 59, 59, 999);

    const billingDay = Number(membership.courseSeason.billingDay);

    while (generationDate && generationDate <= today) {
      const billingYear = currentBillingYear;
      const billingMonth = currentBillingMonth;

      const maxDaysInCurrentMonth = new Date(
        billingYear,
        billingMonth,
        0,
      ).getDate();
      const safeCurrentBillingDay = Math.min(billingDay, maxDaysInCurrentMonth);
      const dueDate = new Date(
        billingYear,
        billingMonth - 1,
        safeCurrentBillingDay,
      );

      let nextYear = billingYear;
      let nextMonth = billingMonth + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const maxDaysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      const safeNextBillingDay = Math.min(billingDay, maxDaysInNextMonth);
      const nextDueDate = new Date(nextYear, nextMonth - 1, safeNextBillingDay);

      const isFirstMonth =
        billingYear === membership.startedAt.getFullYear() &&
        billingMonth - 1 === membership.startedAt.getMonth();

      let description = this.buildMonthlyDescription(
        membership,
        billingYear,
        billingMonth,
      );

      if (isFirstMonth && nextDueDate) {
        const cycleDays = Math.round(
          (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const activeDays = Math.max(
          0,
          Math.round(
            (nextDueDate.getTime() - membership.startedAt.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        if (activeDays > 0 && activeDays !== cycleDays) {
          description += ` (Prorrateo por ${activeDays} días)`;
        }
      }

      const exists = await tx.studentCharge.findUnique({
        where: {
          studentMembershipId_type_billingMonth_billingYear: {
            studentMembershipId: membership.id,
            type: TypeMembershipCharge.MONTHLY_FEE,
            billingYear,
            billingMonth,
          },
        },
      });

      if (!exists) {
        const amount = this.calculateMonthlyFeeForDate(
          membership,
          dueDate,
          isFirstMonth,
          nextDueDate,
        );
        if (amount > 0) {
          await this.createCharge(
            tx,
            membership.id,
            { description, amount, dueDate },
            TypeMembershipCharge.MONTHLY_FEE,
            billingYear,
            billingMonth,
          );
        }
      }

      const nextGenerationDate = new Date(nextDueDate);
      nextGenerationDate.setDate(
        nextGenerationDate.getDate() -
          membership.courseSeason.chargeGenerationDaysBefore,
      );

      if (nextDueDate > seasonEnd) {
        nextPointer = null;
        break;
      }

      nextPointer = nextGenerationDate;
      generationDate = nextGenerationDate;
      currentBillingYear = nextYear;
      currentBillingMonth = nextMonth;
    }

    if (
      membership.nextMonthlyChargeGenerationDate?.getTime() !==
      nextPointer?.getTime()
    ) {
      await tx.studentMembership.update({
        where: { id: membership.id },
        data: { nextMonthlyChargeGenerationDate: nextPointer },
      });
    }
  }

  private calculateRegistrationFee(
    membership: StudentMembershipWithRelations,
  ): number {
    const base = Number(membership.courseSeason.registrationFee);
    const discount = Math.min(
      100,
      Number(membership.paymentPlan.registrationDiscountPercent) +
        membership.studentDiscounts
          .filter((d) => {
            const date = membership.startedAt;
            return d.startDate <= date && (!d.endDate || d.endDate >= date);
          })
          .reduce((sum, d) => sum + Number(d.registrationDiscountPercent), 0),
    );

    return Math.max(0, base - (base * discount) / 100);
  }

  private calculateMonthlyFeeForDate(
    membership: StudentMembershipWithRelations,
    dueDate: Date,
    isFirstMonth: boolean = false,
    nextDueDate?: Date,
  ): number {
    let base = Number(membership.courseSeason.monthlyFee);

    if (isFirstMonth && nextDueDate) {
      const cycleDays = Math.round(
        (nextDueDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const activeDays = Math.round(
        (nextDueDate.getTime() - membership.startedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const factor = Math.max(0, cycleDays > 0 ? activeDays / cycleDays : 1);
      base = base * factor;
    }

    const discount = Math.min(
      100,
      Number(membership.paymentPlan.monthlyDiscountPercent) +
        membership.studentDiscounts
          .filter((d) => {
            const evalDate =
              dueDate < membership.startedAt ? membership.startedAt : dueDate;
            return (
              d.startDate <= evalDate && (!d.endDate || d.endDate >= evalDate)
            );
          })
          .reduce((sum, d) => sum + Number(d.monthlyDiscountPercent), 0),
    );

    return Math.max(0, base - (base * discount) / 100);
  }

  private buildMonthlyDescription(
    membership: StudentMembershipWithRelations,
    billingYear: number,
    billingMonth: number,
  ): string {
    const isEnrollmentMonth =
      billingYear === membership.startedAt.getFullYear() &&
      billingMonth - 1 === membership.startedAt.getMonth();

    if (isEnrollmentMonth) {
      return 'Primera Mensualidad Curso';
    }

    const capitalizedMonthName = this.MONTH_NAMES[billingMonth - 1];
    return `Mensualidad Curso - ${capitalizedMonthName} ${billingYear}`;
  }

  private async createCharge(
    tx: Prisma.TransactionClient,
    membershipId: string,
    charge: {
      description: string;
      amount: number;
      dueDate: Date;
    },
    type: TypeMembershipCharge,
    billingYear: number,
    billingMonth: number,
  ) {
    await tx.charge.create({
      data: {
        description: charge.description,
        amount: charge.amount,
        pendingAmount: charge.amount,
        dueDate: charge.dueDate,
        status: StatusCharge.PENDING,
        studentCharges: {
          create: {
            studentMembershipId: membershipId,
            type,
            billingYear,
            billingMonth,
          },
        },
      },
    });
  }

  // Métodos CRUD para StudentCharge
  async createStudentCharge(createStudentChargeDto: CreateStudentChargeDto) {
    const newStudentCharge = await this.prisma.studentCharge.create({
      data: createStudentChargeDto,
      select: studentChargeSelect,
    });
    return {
      message: 'Cargo escolar registrado con éxito',
      data: newStudentCharge,
    };
  }

  async findAll(paginationDto: StudentChargesPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.StudentChargeWhereInput = {};

    if (search) {
      where.OR = [
        {
          charge: {
            description: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [charges, totalItems] = await Promise.all([
      this.prisma.studentCharge.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: studentChargeSelect,
      }),
      this.prisma.studentCharge.count({ where }),
    ]);

    return createPaginationResult(
      charges,
      totalItems,
      page,
      per_page,
      'Cargos escolares obtenidos exitosamente',
    );
  }

  async findOne(id: string) {
    const charge = await this.prisma.studentCharge.findUnique({
      where: { id },
      select: studentChargeSelect,
    });
    if (!charge) {
      throw new NotFoundException(
        'El cargo escolar solicitado no fue encontrado',
      );
    }
    return {
      message: 'Cargo escolar obtenido exitosamente',
      data: charge,
    };
  }

  async update(id: string, updateStudentChargeDto: UpdateStudentChargeDto) {
    const charge = await this.prisma.studentCharge.findUnique({
      where: { id },
    });
    if (!charge) {
      throw new NotFoundException(
        'El cargo escolar solicitado no fue encontrado',
      );
    }

    const updatedCharge = await this.prisma.studentCharge.update({
      where: { id },
      data: updateStudentChargeDto,
      select: studentChargeSelect,
    });

    return {
      message: 'Cargo escolar actualizado exitosamente',
      data: updatedCharge,
    };
  }

  async remove(id: string) {
    const charge = await this.prisma.studentCharge.findUnique({
      where: { id },
    });
    if (!charge) {
      throw new NotFoundException(
        'El cargo escolar solicitado no fue encontrado',
      );
    }

    const deletedCharge = await this.prisma.studentCharge.delete({
      where: { id },
      select: studentChargeSelect,
    });

    return {
      message: 'Cargo escolar eliminado exitosamente',
      data: deletedCharge,
    };
  }
}
