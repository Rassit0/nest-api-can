import { Prisma, EventStatus } from 'src/generated/prisma/client';
import { ForbiddenException } from '@nestjs/common';

export class MatchLifecyclePolicy {
  /**
   * Acquires a row lock on the Event to prevent concurrent state transitions and updates.
   * Returns the locked Event status.
   */
  static async lockEventForMatchLifecycle(
    tx: Prisma.TransactionClient,
    eventId: string
  ): Promise<EventStatus> {
    const events = await tx.$queryRaw<{ status: EventStatus }[]>`
      SELECT "status" FROM "events"
      WHERE "id" = ${eventId}
      FOR UPDATE
    `;
    if (!events.length) {
      throw new ForbiddenException('El evento no existe.');
    }
    return events[0].status;
  }

  /**
   * Asserts that a match is strictly SCHEDULED and therefore editable.
   * Throws a ForbiddenException if it is COMPLETED or CANCELLED.
   */
  static assertScheduled(status: EventStatus, action: string = 'modificar'): void {
    if (status === EventStatus.COMPLETED) {
      throw new ForbiddenException(`El partido está completado. Debes reabrirlo antes de ${action}lo.`);
    }
    if (status === EventStatus.CANCELLED) {
      throw new ForbiddenException(`El partido está cancelado. Debes restaurarlo antes de ${action}lo.`);
    }
  }

  /**
   * Asserts that structural fields can be modified.
   * If the match has CallUps, structural fields (Teams, Categories, Date) are locked.
   */
  static assertStructuralFieldsEditable(
    hasCallUps: boolean,
    isChangingStructuralFields: boolean,
  ): void {
    if (hasCallUps && isChangingStructuralFields) {
      throw new ForbiddenException(
        'No puedes cambiar equipos, categorías o fecha mientras existan jugadores convocados. Vacía primero la convocatoria del partido.'
      );
    }
  }

  /**
   * Checks if a transition from currentStatus to targetStatus is valid.
   * Allowed:
   * SCHEDULED -> COMPLETED
   * SCHEDULED -> CANCELLED
   * COMPLETED -> SCHEDULED
   * CANCELLED -> SCHEDULED
   */
  static assertValidTransition(currentStatus: EventStatus, targetStatus: EventStatus): void {
    if (currentStatus === targetStatus) {
      throw new ForbiddenException(`El partido ya se encuentra en estado ${currentStatus}.`);
    }

    if (currentStatus === EventStatus.COMPLETED && targetStatus !== EventStatus.SCHEDULED) {
      throw new ForbiddenException('Un partido completado solo puede ser reabierto a SCHEDULED.');
    }

    if (currentStatus === EventStatus.CANCELLED && targetStatus !== EventStatus.SCHEDULED) {
      throw new ForbiddenException('Un partido cancelado solo puede ser restaurado a SCHEDULED.');
    }
    
    // Si currentStatus es SCHEDULED, targetStatus puede ser COMPLETED o CANCELLED, lo cual es válido y no entra en las condiciones anteriores.
  }
}
