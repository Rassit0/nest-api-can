import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';

type ChargeWithRelations = Prisma.ChargeGetPayload<{
  include: {
    studentCharges: {
      include: {
        studentMembership: {
          include: {
            courseSeason: true;
          };
        };
      };
    };
  };
}>;

const chargeInclude = {
  studentCharges: {
    include: {
      studentMembership: {
        include: {
          courseSeason: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class StudentLateFeeService {
  private readonly logger = new Logger(StudentLateFeeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyDailyLateFees() {
    this.logger.log(
      'Iniciando proceso diario de cálculo de recargos escolares (mora)...',
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar cargos base vencidos de mensualidad de estudiantes
    const overdueCharges = await this.prisma.charge.findMany({
      where: {
        status: {
          in: [StatusCharge.PENDING, StatusCharge.PARTIAL],
        },
        studentCharges: {
          some: {
            type: TypeMembershipCharge.MONTHLY_FEE,
            studentMembership: {
              status: {
                in: [
                  StudentMembershipStatus.ACTIVE,
                  StudentMembershipStatus.PENDING,
                  StudentMembershipStatus.SUSPENDED,
                ],
              },
            },
          },
        },
        parentChargeId: null,
        dueDate: {
          lt: today,
        },
      },
      include: chargeInclude,
    });

    this.logger.log(
      `Se encontraron ${overdueCharges.length} cargos escolares vencidos base.`,
    );

    for (const baseCharge of overdueCharges) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.processChargeLateFee(tx, baseCharge, today);
        });
      } catch (error) {
        this.logger.error(
          `Error procesando recargos de mora para el cargo escolar ID ${baseCharge.id}:`,
          error,
        );
      }
    }

    this.logger.log('Proceso de recargos escolares finalizado.');
  }

  private async processChargeLateFee(
    tx: Prisma.TransactionClient,
    baseCharge: ChargeWithRelations,
    today: Date,
  ) {
    const studentChargeRelation = baseCharge.studentCharges[0];
    if (!studentChargeRelation) return;

    const courseSeason = studentChargeRelation.studentMembership?.courseSeason;
    if (!courseSeason) return;

    if (!courseSeason.lateFeeEnabled) return;

    const dueDate = new Date(baseCharge.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const elapsedDays = this.calculateElapsedDays(dueDate, today);
    const graceDays = Number(courseSeason.graceDays || 0);

    if (elapsedDays <= graceDays) return;

    const penaltyDays = elapsedDays - graceDays;
    const lateFeePerDay = Number(courseSeason.lateFeePerDay || 0);
    const targetLateFeeAmount = penaltyDays * lateFeePerDay;

    if (targetLateFeeAmount <= 0) return;

    // Buscar si ya existe el cargo hijo de recargo
    const existingLateFeeCharge = await tx.charge.findFirst({
      where: {
        parentChargeId: baseCharge.id,
        studentCharges: {
          some: {
            type: TypeMembershipCharge.LATE_FEE,
          },
        },
      },
    });

    if (existingLateFeeCharge) {
      if (
        existingLateFeeCharge.status === StatusCharge.PENDING ||
        existingLateFeeCharge.status === StatusCharge.PARTIAL ||
        existingLateFeeCharge.status === StatusCharge.PAID
      ) {
        const previousAmount = Number(existingLateFeeCharge.amount);
        const difference = targetLateFeeAmount - previousAmount;

        if (difference > 0) {
          await tx.charge.update({
            where: { id: existingLateFeeCharge.id },
            data: {
              amount: targetLateFeeAmount,
              pendingAmount:
                Number(existingLateFeeCharge.pendingAmount) + difference,
              status:
                existingLateFeeCharge.status === StatusCharge.PAID
                  ? StatusCharge.PARTIAL
                  : existingLateFeeCharge.status,
              description: `Recargo Mora Curso - ${penaltyDays} x ${lateFeePerDay}/día`,
            },
          });
        }
      }
    } else {
      // Crear cargo de recargo desde cero
      await tx.charge.create({
        data: {
          parentChargeId: baseCharge.id,
          description: `Recargo Mora Curso - ${penaltyDays} días de retraso`,
          amount: targetLateFeeAmount,
          pendingAmount: targetLateFeeAmount,
          dueDate: today,
          status: StatusCharge.PENDING,
          studentCharges: {
            create: {
              type: TypeMembershipCharge.LATE_FEE,
              studentMembershipId: studentChargeRelation.studentMembershipId,
              createdByCron: true,
            },
          },
        },
      });
    }
  }

  private calculateElapsedDays(dueDate: Date, today: Date) {
    const diffTime = today.getTime() - dueDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }
}
