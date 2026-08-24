import { Prisma, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';
import { validateCourseSeasonCapacity } from './capacity.helper';
import { isCycleEnrollmentExpired } from './cycle-enrollment.helper';

export async function syncCycleEnrollmentStatus(
  tx: Prisma.TransactionClient,
  chargeId: string,
  newChargeStatus: StatusCharge,
): Promise<void> {
  let targetStatus: CycleEnrollmentStatus;

  if (newChargeStatus === StatusCharge.PAID) {
    targetStatus = CycleEnrollmentStatus.CONFIRMED;
  } else if (newChargeStatus === StatusCharge.PENDING || newChargeStatus === StatusCharge.PARTIAL) {
    targetStatus = CycleEnrollmentStatus.PENDING;
  } else if (newChargeStatus === StatusCharge.CANCELLED) {
    targetStatus = CycleEnrollmentStatus.CANCELLED;
  } else {
    return;
  }

  const enrollmentsToUpdate = await tx.cycleEnrollment.findMany({
    where: { 
      chargeId: chargeId, 
      status: { not: targetStatus }
    },
    include: {
      studentMembership: { select: { courseSeasonShiftId: true } }
    }
  });

  for (const enrollment of enrollmentsToUpdate) {
    if (targetStatus === CycleEnrollmentStatus.CONFIRMED) {
      if (isCycleEnrollmentExpired(enrollment.createdAt)) {
        throw new BadRequestException('El pago fue rechazado porque la reserva del ciclo ya expiró.');
      }

      // Validar JIT antes de consolidar
      await validateCourseSeasonCapacity(
        tx,
        enrollment.studentMembership.courseSeasonShiftId,
        enrollment.cycleStartDate,
        enrollment.cycleEndDate,
        enrollment.id // Excluirse a sí mismo para no causar un falso positivo
      );
    }

    await tx.cycleEnrollment.update({
      where: { id: enrollment.id },
      data: { status: targetStatus },
    });
  }
}