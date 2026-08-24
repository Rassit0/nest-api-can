import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StudentMembershipRepository } from '../repositories/student-membership.repository';
import { StudentCycleManagerService } from './student-cycle-manager.service';
import { CycleEnrollmentStatus, StudentMembershipStatus } from 'src/generated/prisma/client';
import { getAbsoluteSeasonCycles } from '../student-billing.utils';
import { ReactivateStudentMembershipDto } from '../dto/reactivate-student-membership.dto';
import { PrismaErrorUtils } from 'src/utils/prisma-error.util';

@Injectable()
export class StudentReactivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepo: StudentMembershipRepository,
    private readonly cycleManager: StudentCycleManagerService,
  ) {}

  private validateReentryDateWithinSeason(membership: any, reentryDate: Date) {
    const { startDate, endDate } = membership.courseSeason.season;
    if (reentryDate.getTime() < startDate.getTime() || reentryDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('La fecha de reingreso debe estar dentro de la temporada.');
    }
  }

  private async determineCycles(membership: any, quantity: number, reentryDate: Date, tx: any = this.prisma) {
    const allCycles = getAbsoluteSeasonCycles(
      membership.courseSeason.season.startDate,
      membership.courseSeason.season.endDate,
      membership.courseSeason.billingConfig.billingFrequency
    );

    const existingEnrollments = await tx.cycleEnrollment.findMany({
      where: { 
        studentMembershipId: membership.id,
        status: { not: CycleEnrollmentStatus.CANCELLED }
      },
      select: { cycleStartDate: true, cycleEndDate: true }
    });

    const validCycles = allCycles.filter(cycle => {
      // Excluir ciclos que terminaron antes o exactamente en la fecha de reingreso.
      if (cycle.cycleEndDate.getTime() <= reentryDate.getTime()) {
        return false;
      }

      // Excluir ya inscritos
      return !existingEnrollments.some(e => 
        e.cycleStartDate.getTime() === cycle.cycleStartDate.getTime() &&
        e.cycleEndDate.getTime() === cycle.cycleEndDate.getTime()
      );
    });

    if (validCycles.length < quantity) {
      throw new BadRequestException(
        `No existen suficientes ciclos disponibles a partir de la fecha solicitada para satisfacer la cantidad requerida (${quantity}). Solo hay ${validCycles.length} disponibles.`
      );
    }

    return validCycles.slice(0, quantity);
  }

  async reactivateWithCycles(membershipId: string, dto: ReactivateStudentMembershipDto) {
    const membership = await this.membershipRepo.getMembershipOrThrow(membershipId);

    if (membership.status !== StudentMembershipStatus.SUSPENDED) {
      throw new BadRequestException('Solo una membresía suspendida puede ser reactivada mediante reingreso.');
    }

    // Resolvemos reentryDate en UTC
    const reentryDate = dto.reentryDate ? new Date(dto.reentryDate) : new Date();

    this.validateReentryDateWithinSeason(membership, reentryDate);

    // Validación optimista antes de la transacción
    await this.determineCycles(membership, dto.quantity, reentryDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Revalidación dentro de transacción para concurrencia
        const cyclesToPurchase = await this.determineCycles(membership, dto.quantity, reentryDate, tx);

        const options = {
          chargeInitialCycle: true, 
          isSeasonFeeOnly: false, 
          billingFrequency: membership.courseSeason.billingConfig.billingFrequency
        };

        const { generatedCount } = await this.cycleManager.enrollCyclesToMembership(
          membership,
          cyclesToPurchase,
          reentryDate,
          options,
          tx
        );

        const updatedMembership = await tx.studentMembership.update({
          where: { id: membership.id },
          data: {
            status: StudentMembershipStatus.ACTIVE,
            suspensionReason: null,
            histories: {
              create: {
                previousStatus: membership.status,
                newStatus: StudentMembershipStatus.ACTIVE,
                reason: 'Reactivación por inscripción a nuevo ciclo',
              },
            },
          },
        });

        return {
          message: `Membresía reactivada exitosamente. Se inscribieron ${generatedCount} ciclos.`,
          membership: updatedMembership
        };
      });
    } catch (error) {
      if (PrismaErrorUtils.isUniqueConstraintViolation(error)) {
        throw new BadRequestException(
          'Error de concurrencia: El ciclo solicitado ya fue procesado o se intentó reactivar simultáneamente.',
        );
      }
      throw error;
    }
  }
}
