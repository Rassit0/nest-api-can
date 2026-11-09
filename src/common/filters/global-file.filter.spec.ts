import { ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { GlobalFileFilter } from './global-file.filter';

jest.mock('fs');

describe('GlobalFileFilter', () => {
  let filter: GlobalFileFilter;
  let mockResponse: any;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new GlobalFileFilter();

    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
      }),
    } as any;

    loggerErrorSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn((filter as any).logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

  it('debe responder HTTP 500 con mensaje genérico ante un error inesperado sin filtrar detalles internos', () => {
    const unexpectedError = new Error('Secret database password leaked in stack trace at /var/www/secret');

    filter.catch(unexpectedError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });

    // Verifica que el mensaje interno NO se haya enviado al cliente
    const responsePayload = mockResponse.json.mock.calls[0][0];
    expect(JSON.stringify(responsePayload)).not.toContain('Secret database password');
    expect(JSON.stringify(responsePayload)).not.toContain('Caught by global filter');

    // Verifica que se haya logueado en el servidor
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unhandled exception caught by global filter:',
      expect.stringContaining('Secret database password'),
    );
  });

  it('debe registrar "No se pudo establecer conexión con PostgreSQL." ante un fallo de conectividad', () => {
    const connError = new AggregateError(
      [Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })],
      'AggregateError [ECONNREFUSED]',
    );

    filter.catch(connError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'No se pudo establecer conexión con PostgreSQL.',
      expect.stringContaining('ECONNREFUSED'),
    );
  });

  it('debe preservar el código HTTP y mensaje de excepciones de negocio (HttpException)', () => {
    const notFoundException = new NotFoundException('Recurso no encontrado');

    filter.catch(notFoundException, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Recurso no encontrado',
      }),
    );

    const badRequestException = new BadRequestException({
      statusCode: 400,
      message: 'Datos inválidos',
      errors: { email: ['Email inválido'] },
    });

    filter.catch(badRequestException, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Datos inválidos',
      errors: { email: ['Email inválido'] },
    });
  });

  it('un fallo al escribir en global-error.txt no debe impedir devolver la respuesta HTTP', () => {
    (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied, open global-error.txt');
    });

    const error = new Error('Boom');

    expect(() => filter.catch(error, mockHost)).not.toThrow();

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo escribir en global-error.txt'),
    );
  });

  it('si headers ya fueron enviados, no debe intentar escribir la respuesta nuevamente', () => {
    mockResponse.headersSent = true;

    filter.catch(new Error('After headers sent'), mockHost);

    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });
});
