import { Prisma } from 'src/generated/prisma/client';
import { isDatabaseConnectionError } from './database-error.util';

describe('isDatabaseConnectionError', () => {
  it('debe reconocer PrismaClientInitializationError como error de conexión', () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:5432`",
      '6.19.3',
    );
    expect(isDatabaseConnectionError(error)).toBe(true);
  });

  it('debe reconocer códigos de error de red y socket (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, etc.)', () => {
    expect(isDatabaseConnectionError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'econnrefused' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'ENOTFOUND' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'EHOSTUNREACH' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('debe reconocer códigos de conectividad propios de Prisma (P1000, P1001, P1002, P1003, P1017)', () => {
    expect(isDatabaseConnectionError({ code: 'P1000' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'P1001' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'P1002' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'P1003' })).toBe(true);
    expect(isDatabaseConnectionError({ code: 'P1017' })).toBe(true);
  });

  it('debe reconocer códigos PostgreSQL de falla de autenticación o caída (28P01, 57P01, 57P03)', () => {
    expect(isDatabaseConnectionError({ code: '28P01' })).toBe(true);
    expect(isDatabaseConnectionError({ code: '57P01' })).toBe(true);
    expect(isDatabaseConnectionError({ code: '57P03' })).toBe(true);
  });

  it('debe reconocer AggregateError cuando contiene errores de conexión (típico de pg-pool)', () => {
    const subError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    (subError as any).code = 'ECONNREFUSED';

    const aggregateError = new AggregateError(
      [subError],
      'AggregateError [ECONNREFUSED]',
    );

    expect(isDatabaseConnectionError(aggregateError)).toBe(true);
  });

  it('debe reconocer errores anidados a través de cause o meta.driverAdapterError', () => {
    const rootError = {
      name: 'PrismaClientUnknownRequestError',
      message: 'Driver error occurred',
      meta: {
        driverAdapterError: {
          code: 'ECONNREFUSED',
          message: 'Connection refused',
        },
      },
    };
    expect(isDatabaseConnectionError(rootError)).toBe(true);

    const errorWithCause = new Error('Wrapper transaction error');
    (errorWithCause as any).cause = { code: 'ETIMEDOUT' };
    expect(isDatabaseConnectionError(errorWithCause)).toBe(true);
  });

  it('debe reconocer patrones de mensaje explícitos de conectividad', () => {
    expect(
      isDatabaseConnectionError(new Error('Connection terminated unexpectedly')),
    ).toBe(true);
    expect(
      isDatabaseConnectionError(new Error("Can't reach database server")),
    ).toBe(true);
    expect(
      isDatabaseConnectionError(new Error('failed to connect to server at 127.0.0.1')),
    ).toBe(true);
  });

  it('NO debe clasificar errores arbitrarios o de lógica de negocio como errores de conexión', () => {
    expect(isDatabaseConnectionError(null)).toBe(false);
    expect(isDatabaseConnectionError(undefined)).toBe(false);
    expect(isDatabaseConnectionError(new Error('Usuario no encontrado'))).toBe(false);
    expect(isDatabaseConnectionError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
    expect(isDatabaseConnectionError({ code: 'P2025', message: 'Record not found' })).toBe(false);
    expect(isDatabaseConnectionError({ code: 'ERR_INVALID_ARG_TYPE' })).toBe(false);

    // AggregateError con errores no relacionados NO debe marcarse como conexión
    const unrelatedAggregate = new AggregateError(
      [new TypeError('Cannot read property of undefined'), new RangeError('Out of bounds')],
      'Generic aggregate error',
    );
    expect(isDatabaseConnectionError(unrelatedAggregate)).toBe(false);
  });

  it('debe protegerse contra referencias circulares en cause sin entrar en recursión infinita', () => {
    const circularObj: any = { message: 'Circular error' };
    circularObj.cause = circularObj;

    expect(() => isDatabaseConnectionError(circularObj)).not.toThrow();
    expect(isDatabaseConnectionError(circularObj)).toBe(false);
  });
});
