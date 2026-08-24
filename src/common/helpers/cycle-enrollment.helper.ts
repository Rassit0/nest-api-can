export const PAYMENT_DEADLINE_HOURS = 24;

/**
 * Retorna la fecha exacta de expiración para un CycleEnrollment pendiente.
 * @param createdAt La fecha de creación del CycleEnrollment
 * @returns Date La fecha y hora de vencimiento
 */
export function getCycleEnrollmentExpirationDate(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000);
}

/**
 * Determina si un CycleEnrollment ya superó su ventana de pago (24h).
 * @param createdAt La fecha de creación del CycleEnrollment
 * @returns boolean true si ya expiró, false si sigue vigente
 */
export function isCycleEnrollmentExpired(createdAt: Date): boolean {
  return Date.now() >= getCycleEnrollmentExpirationDate(createdAt).getTime();
}
