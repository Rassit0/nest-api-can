import { ArgumentsHost } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockI18n: Partial<I18nService>;
  let mockResponse: any;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockI18n = {
      t: jest.fn().mockImplementation((key: string) => `translated_${key}`),
      translate: jest.fn().mockImplementation((key: string) => `translated_${key}`),
    };

    filter = new PrismaExceptionFilter(mockI18n as I18nService);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => ({ method: 'POST' }),
      }),
    } as any;

    loggerErrorSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('debe registrar "No se pudo establecer conexión con PostgreSQL." y responder 500 ante PrismaClientInitializationError', () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:5432`",
      '6.19.3',
    );

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'No se pudo establecer conexión con PostgreSQL.',
      expect.stringContaining("Can't reach database server"),
    );
  });

  it('debe registrar "No se pudo establecer conexión con PostgreSQL." y responder 500 ante códigos P1000/P1001/P1002/P1003/P1017', () => {
    const error = new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
      code: 'P1001',
      clientVersion: '6.19.3',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'No se pudo establecer conexión con PostgreSQL.',
      expect.objectContaining({ code: 'P1001' }),
    );
  });

  it('debe mantener el tratamiento de P2025 devolviendo 404 Not Found', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.19.3',
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
      }),
    );
  });

  it('debe mantener el tratamiento de P2002 devolviendo 409 Conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['email'] },
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Ya existe un registro con los datos proporcionados',
      }),
    );
  });

  it('debe mantener el tratamiento de P2003 devolviendo 400 Bad Request', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '6.19.3',
      meta: { field_name: 'category_id_fkey' },
    });

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
      }),
    );
  });

  it('debe identificar errores no controlados que contengan fallo de conexión en cause y loguear adecuadamente', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unknown query error', {
      code: 'P9999',
      clientVersion: '6.19.3',
    });
    (error as any).cause = { code: 'ECONNREFUSED' };

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'No se pudo establecer conexión con PostgreSQL.',
      expect.objectContaining({ code: 'P9999' }),
    );
  });
});
