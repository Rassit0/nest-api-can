import { PrismaClient, Prisma, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { isCycleEnrollmentExpired } from './cycle-enrollment.helper';

export async function cleanupExpiredEnrollmentIfNeeded(
  prisma: Prisma.TransactionClient,
  cycleEnrollmentId?: string,
  chargeId?: string,
): Promise<boolean> {
  const whereClause: any = {};
  if (cycleEnrollmentId) whereClause.id = cycleEnrollmentId;
  else if (chargeId) whereClause.chargeId = chargeId;
  else return false;

  const cycle = await prisma.cycleEnrollment.findFirst({
    where: whereClause,
    include: {
      charge: {
        include: {
          payments: true,
        },
      },
      studentMembership: true,
    },
  });

  if (!cycle) return false;

  // Solo procesar si está pendiente y expirado
  if (cycle.status !== CycleEnrollmentStatus.PENDING) return false;
  if (!isCycleEnrollmentExpired(cycle.createdAt)) return false;

  // Verificamos si podemos hacer un hard delete
  let canHardDelete = false;

  if (cycle.charge) {
    const charge = cycle.charge;
    // Solo permitimos eliminar físicamente si:
    // 1. Está completamente impago (PENDING)
    // 2. pendingAmount === amount
    // 3. No tiene pagos asociados
    const expectedPendingAmount = Number(charge.amount) + Number(charge.adjustmentAmount || 0);
    const isUnpaid =
      charge.status === StatusCharge.PENDING &&
      Number(charge.pendingAmount) === expectedPendingAmount &&
      (!charge.payments || charge.payments.length === 0);

    if (isUnpaid) {
      canHardDelete = true;
    }
  } else {
    // Si no tiene cargo, podemos eliminarlo físicamente
    canHardDelete = true;
  }

  if (canHardDelete) {
    // Eliminar StudentCharge si existe
    if (cycle.chargeId) {
      await prisma.studentCharge.deleteMany({
        where: { chargeId: cycle.chargeId },
      });
      // Eliminar el CycleEnrollment
      await prisma.cycleEnrollment.delete({
        where: { id: cycle.id },
      });
      // Eliminar el Charge
      await prisma.charge.delete({
        where: { id: cycle.chargeId },
      });
    } else {
      await prisma.cycleEnrollment.delete({
        where: { id: cycle.id },
      });
    }
  } else {
    // Soft delete (Fallback si hay transacciones parciales)
    if (cycle.chargeId && cycle.charge) {
      if (
        cycle.charge.status === StatusCharge.PENDING ||
        cycle.charge.status === StatusCharge.PARTIAL
      ) {
        await prisma.charge.update({
          where: { id: cycle.chargeId },
          data: { status: StatusCharge.CANCELLED },
        });
      }
    }
    await prisma.cycleEnrollment.update({
      where: { id: cycle.id },
      data: { status: CycleEnrollmentStatus.CANCELLED },
    });
  }

  return true;
}
