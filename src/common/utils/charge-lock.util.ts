import { Prisma, Charge } from 'src/generated/prisma/client';
import { NotFoundException } from '@nestjs/common';

/**
 * Obtiene un Charge aplicando un bloqueo pesimista a nivel de fila.
 *
 * IMPORTANTE:
 * Este lock protege las operaciones Read-Modify-Write sobre
 * `pendingAmount` frente a pagos, reversos y generación concurrente
 * de Late Fees.
 *
 * Debe ejecutarse dentro de la misma transacción que posteriormente
 * modifica el Charge. PostgreSQL mantiene el bloqueo hasta COMMIT/ROLLBACK.
 *
 * Sin este bloqueo, dos procesos podrían leer el mismo pendingAmount,
 * calcular saldos diferentes y el último UPDATE sobrescribir el resultado
 * del otro proceso (Lost Update).
 */
export async function lockChargeForUpdate(
  tx: Prisma.TransactionClient,
  chargeId: string,
): Promise<Charge> {
  const result = await tx.$queryRaw<Charge[]>`
    SELECT *
    FROM "charges" 
    WHERE id = ${chargeId} 
    FOR UPDATE
  `;

  if (!result || result.length === 0) {
    throw new NotFoundException(`Charge con ID ${chargeId} no encontrado`);
  }

  const raw = result[0] as any;
  return {
    ...raw,
    pendingAmount: raw.pending_amount,
    adjustmentAmount: raw.adjustment_amount,
    parentChargeId: raw.parent_charge_id,
    dueDate: raw.due_date,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    chargeCategory: raw.charge_category,
    createdById: raw.created_by_id,
    updatedById: raw.updated_by_id,
    adjustmentReason: raw.adjustment_reason,
  } as Charge;
}
