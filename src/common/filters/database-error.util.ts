import { Prisma } from 'src/generated/prisma/client';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNRESET',
  'EAI_AGAIN',
  'P1000', // Authentication failed against database server
  'P1001', // Can't reach database server
  'P1002', // The database server was reached but timed out
  'P1003', // Database does not exist
  'P1017', // Server has closed the connection
  '28P01', // PostgreSQL password authentication failed
  '28000', // PostgreSQL invalid authorization
  '3D000', // PostgreSQL database does not exist
  '57P01', // PostgreSQL admin shutdown
  '57P02', // PostgreSQL crash shutdown
  '57P03', // PostgreSQL cannot connect now
]);

const CONNECTION_MESSAGE_PATTERNS = [
  /ECONNREFUSED/i,
  /connection terminated/i,
  /connection timeout/i,
  /timeout expired/i,
  /failed to connect to server/i,
  /can't reach database server/i,
  /could not connect to server/i,
  /the database system is starting up/i,
  /the database system is shutting down/i,
  /connection refused/i,
];

/**
 * Determina si un error corresponde a una falla de conectividad con la base de datos (PostgreSQL/Prisma).
 * Inspecciona de manera defensiva códigos de socket/red, códigos de error de Prisma/PostgreSQL,
 * errores de inicialización, AggregateError (pg-pool), causas anidadas y driver adapters.
 */
export function isDatabaseConnectionError(error: unknown, depth = 0): boolean {
  if (!error || depth > 5) return false;

  // 1. PrismaClientInitializationError
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (typeof error === 'object' && (error as any)?.name === 'PrismaClientInitializationError')
  ) {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as any;

    // 2. Comprobación directa de código
    if (typeof err.code === 'string' && CONNECTION_CODES.has(err.code.toUpperCase())) {
      return true;
    }

    // 3. AggregateError (Node.js 18+ / pg-pool)
    if (
      Array.isArray(err.errors) &&
      (err.name === 'AggregateError' || (typeof AggregateError !== 'undefined' && err instanceof AggregateError))
    ) {
      const hasConn = err.errors.some((sub: unknown) => isDatabaseConnectionError(sub, depth + 1));
      if (hasConn) return true;
    }

    // 4. Causa anidada (Error.cause standard ES2022)
    if (err.cause && isDatabaseConnectionError(err.cause, depth + 1)) {
      return true;
    }

    // 5. Driver adapter error wrappers (Prisma: meta.driverAdapterError)
    if (err.meta?.driverAdapterError && isDatabaseConnectionError(err.meta.driverAdapterError, depth + 1)) {
      return true;
    }

    // 6. Mensajes explícitos de conectividad
    if (typeof err.message === 'string') {
      if (CONNECTION_MESSAGE_PATTERNS.some((pattern) => pattern.test(err.message))) {
        return true;
      }
    }
  }

  return false;
}
