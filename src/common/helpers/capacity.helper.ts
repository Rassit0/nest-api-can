import { Prisma, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { BadRequestException } from '@nestjs/common';

const GRACE_PERIOD_HOURS = 24;

/**
 * Retorna las condiciones Prisma (WhereInput) para determinar si un CycleEnrollment
 * ocupa un asiento de forma válida.
 *
 * Un asiento está ocupado si:
 * 1. El estado es CONFIRMED.
 * 2. El estado es PENDING y su fecha de creación está dentro de las últimas 24 horas.
 */
export function buildValidOccupancyCondition(): Prisma.CycleEnrollmentWhereInput {
  const graceWindow = new Date();
  graceWindow.setHours(graceWindow.getHours() - GRACE_PERIOD_HOURS);

  return {
    OR: [
      { status: CycleEnrollmentStatus.CONFIRMED },
      {
        status: CycleEnrollmentStatus.PENDING,
        createdAt: { gte: graceWindow },
      },
    ],
  };
}

/**
 * Valida de forma segura contra concurrencia si existe capacidad para un nuevo CycleEnrollment.
 * 
 * IMPORTANTE: Esta función DEBE ejecutarse dentro de una transacción interactiva de Prisma (tx).
 * Adquiere un bloqueo exclusivo sobre la fila de la temporada (CourseSeason) para serializar accesos.
 */
export async function validateCourseSeasonCapacity(
  tx: Prisma.TransactionClient,
  courseSeasonShiftId: string,
  cycleStartDate: Date,
  cycleEndDate: Date,
  excludeEnrollmentId?: string,
): Promise<void> {
  // 1. Obtener la capacidad máxima y bloquear la fila maestra (FOR UPDATE)
  const results = await tx.$queryRaw<{ maxMembers: number | null }[]>`
    SELECT max_members as "maxMembers"
    FROM course_season_shifts
    WHERE id = ${courseSeasonShiftId}
    FOR UPDATE
  `;

  if (!results || results.length === 0) {
    throw new BadRequestException('La temporada de curso no fue encontrada');
  }

  const maxMembers = results[0].maxMembers;

  if (maxMembers === null || maxMembers === undefined) {
    return; // Capacidad ilimitada
  }

  // 2. Contar la ocupación física real basada en CycleEnrollment
  const validOccupancyCondition = buildValidOccupancyCondition();

  const whereCondition: Prisma.CycleEnrollmentWhereInput = {
    courseSeasonShiftId: courseSeasonShiftId,
    // Regla de intersección de fechas para validar si conviven en el mismo ciclo temporal
    cycleStartDate: { lt: cycleEndDate },
    cycleEndDate: { gt: cycleStartDate },
    // Solo contar ocupaciones válidas (CONFIRMED o PENDING reciente)
    ...validOccupancyCondition,
  };

  if (excludeEnrollmentId) {
    whereCondition.id = { not: excludeEnrollmentId };
  }

  const occupiedSeats = await tx.cycleEnrollment.count({
    where: whereCondition,
  });

  if (occupiedSeats >= maxMembers) {
    throw new BadRequestException(
      'El cupo de este ciclo ya no está disponible. La reserva temporal expiró y el turno actualmente se encuentra lleno.',
    );
  }
}
