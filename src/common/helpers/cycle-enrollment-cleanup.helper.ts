import { Prisma, StatusCharge, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { isCycleEnrollmentExpired } from './cycle-enrollment.helper';

/**
 * Limpieza/Cancelación lógica segura de inscripciones de ciclos expiradas.
 * NUNCA elimina físicamente registros (evita hard delete).
 * Preserva integridad contable e histórica.
 */
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

  // Validar seguridad financiera: no cancelar si tiene pagos efectivos o en proceso
  if (cycle.charge) {
    const charge = cycle.charge;
    const hasActivePayments = (charge.payments || []).some(
      (p: any) => p.status === 'COMPLETED' || p.status === 'PENDING',
    );

    if (hasActivePayments) {
      // No se puede cancelar automáticamente un cargo con pagos
      return false;
    }

    if (charge.status === StatusCharge.PAID || charge.status === StatusCharge.PARTIAL) {
      return false;
    }

    // Cancelación lógica del cargo
    await prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: StatusCharge.CANCELLED,
        pendingAmount: new Prisma.Decimal(0),
        adjustmentReason: 'Cancelado automáticamente por vencimiento de reserva (72h)',
      },
    });
  }

  // Cancelación lógica del CycleEnrollment (el cálculo de cupos ya excluye CANCELLED automáticamente)
  await prisma.cycleEnrollment.update({
    where: { id: cycle.id },
    data: { status: CycleEnrollmentStatus.CANCELLED },
  });

  return true;
}
