import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Prisma,
  StatusCharge,
  TypeMembershipCharge,
} from 'src/generated/prisma/client';
import { DateUtils } from 'src/utils/date.utils';
import {
  StudentLateFeeRepository,
  StudentChargeWithLateFeeRelations,
} from './repositories/student-late-fee.repository';

export interface LateFeePreview {
  baseChargeId: string;
  elapsedDays: number;
  penaltyDays: number;
  lateFeePerDay: number;
  totalLateFeeAmount: number;
}

@Injectable()
export class StudentLateFeeService {
  private readonly logger = new Logger(StudentLateFeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lateFeeRepo: StudentLateFeeRepository,
  ) {}

  async previewLateFee(chargeId: string): Promise<LateFeePreview> {
    const baseCharge = await this.lateFeeRepo.findChargeForLateFee(chargeId);
    if (!baseCharge) {
      throw new NotFoundException(
        'Cargo no encontrado o no pertenece a un CourseSeason.',
      );
    }

    return this.calculateLateFee(baseCharge);
  }

  async applyLateFee(chargeId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const baseCharge = await this.lateFeeRepo.findChargeForLateFee(
        chargeId,
        tx,
      );
      if (!baseCharge) {
        throw new NotFoundException(
          'Cargo no encontrado o no pertenece a un CourseSeason.',
        );
      }

      const preview = this.calculateLateFee(baseCharge);

      if (preview.totalLateFeeAmount <= 0) {
        throw new BadRequestException(
          'El monto de mora calculado es 0 o menor.',
        );
      }

      const existingLateFee = await this.lateFeeRepo.findPendingLateFeeCharge(
        tx,
        chargeId,
      );
      if (existingLateFee) {
        throw new BadRequestException(
          'Ya existe un recargo por mora pendiente de pago para este cargo. Cancele o pague el recargo actual antes de generar uno nuevo.',
        );
      }

      const studentChargeRelation = baseCharge.studentCharges[0];

      const newCharge = await this.lateFeeRepo.createLateFeeCharge(tx, {
        parentChargeId: baseCharge.id,
        chargeCategory: 'LATE_FEE',
        description: `Recargo Mora Curso - ${preview.penaltyDays} dias de retraso a ${preview.lateFeePerDay}/dia`,
        amount: preview.totalLateFeeAmount,
        pendingAmount: preview.totalLateFeeAmount,
        dueDate: new Date(),
        status: StatusCharge.PENDING,
        studentCharges: {
          create: {
            type: TypeMembershipCharge.LATE_FEE,
            studentMembershipId: studentChargeRelation.studentMembershipId,
            createdByCron: false,
          },
        },
      });

      return {
        message: 'Recargo por mora aplicado exitosamente.',
        data: newCharge,
      };
    });
  }

  private calculateLateFee(
    baseCharge: StudentChargeWithLateFeeRelations,
  ): LateFeePreview {
    if (
      baseCharge.status === StatusCharge.PAID ||
      baseCharge.status === StatusCharge.CANCELLED
    ) {
      throw new BadRequestException(
        `No se puede calcular mora sobre un cargo en estado ${baseCharge.status}.`,
      );
    }

    const studentChargeRelation = baseCharge.studentCharges[0];
    if (!studentChargeRelation) {
      throw new BadRequestException(
        'El cargo no esta vinculado a un estudiante.',
      );
    }

    const courseSeason = studentChargeRelation.studentMembership?.courseSeason;
    if (!courseSeason) {
      throw new BadRequestException(
        'No se encontro la configuracion de CourseSeason para este cargo.',
      );
    }

    if (courseSeason.billingConfig?.lateFeeEnabled === false) {
      throw new BadRequestException(
        'La mora esta deshabilitada para esta temporada.',
      );
    }

    const evaluationDate = DateUtils.getEndOfLocalDayInUTC(new Date());
    const dueDate = DateUtils.getEndOfLocalDayInUTC(baseCharge.dueDate);

    const courseSeasonPauses = courseSeason.pauses || [];
    const individualPauses =
      studentChargeRelation.studentMembership?.pauses || [];

    const allPauses = [...courseSeasonPauses, ...individualPauses];
    let pausedDays = 0;

    if (allPauses.length > 0) {
      const intervals = allPauses
        .map((p) => {
          const pStart = DateUtils.getEndOfLocalDayInUTC(p.startDate);
          const pEnd = DateUtils.getEndOfLocalDayInUTC(p.endDate);
          return {
            start: pStart < dueDate ? dueDate.getTime() : pStart.getTime(),
            end:
              pEnd > evaluationDate ? evaluationDate.getTime() : pEnd.getTime(),
          };
        })
        .filter((i) => i.start <= i.end);

      if (intervals.length > 0) {
        intervals.sort((a, b) => a.start - b.start);
        const merged = [intervals[0]];
        for (let i = 1; i < intervals.length; i++) {
          const current = intervals[i];
          const last = merged[merged.length - 1];
          if (current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
          } else {
            merged.push(current);
          }
        }

        for (const m of merged) {
          pausedDays +=
            Math.round((m.end - m.start) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    }

    const elapsedDays = Math.max(
      0,
      this.calculateElapsedDays(dueDate, evaluationDate) - pausedDays,
    );
    const graceDays = Number(courseSeason.billingConfig?.graceDays || 0);

    if (elapsedDays <= graceDays) {
      return {
        baseChargeId: baseCharge.id,
        elapsedDays,
        penaltyDays: 0,
        lateFeePerDay: Number(courseSeason.billingConfig?.lateFeePerDay || 0),
        totalLateFeeAmount: 0,
      };
    }

    const penaltyDays = elapsedDays - graceDays;
    const lateFeePerDay = Number(
      courseSeason.billingConfig?.lateFeePerDay || 0,
    );
    const totalLateFeeAmount = penaltyDays * lateFeePerDay;

    return {
      baseChargeId: baseCharge.id,
      elapsedDays,
      penaltyDays,
      lateFeePerDay,
      totalLateFeeAmount,
    };
  }

  private calculateElapsedDays(dueDate: Date, evaluationDate: Date) {
    const diffTime = evaluationDate.getTime() - dueDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }
}
