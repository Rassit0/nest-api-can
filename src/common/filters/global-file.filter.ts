import {
  Catch,
  ArgumentsHost,
  Logger,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { isDatabaseConnectionError } from './database-error.util';

@Catch()
export class GlobalFileFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalFileFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Si la respuesta ya fue enviada por el socket, evitar escribir nuevamente
    if (res.headersSent) {
      return;
    }

    const errorStack = exception?.stack || String(exception);

    // 1. Guardar de forma segura en archivo de diagnóstico sin propagar fallos de I/O
    try {
      fs.writeFileSync('global-error.txt', errorStack);
    } catch (fileErr) {
      this.logger.warn(
        `No se pudo escribir en global-error.txt: ${fileErr?.message || fileErr}`,
      );
    }

    // 2. Si es una excepción HTTP legítima (e.g. 400, 401, 403, 404, 409), preservar código y mensaje
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (status >= 500) {
        this.logger.error('Unhandled HttpException caught by global filter:', errorStack);
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        return res.status(status).json(exceptionResponse);
      }

      return res.status(status).json({
        statusCode: status,
        message: exception.message,
      });
    }

    // 3. Si es un fallo de conectividad con la base de datos (PostgreSQL/Prisma/pg driver)
    if (isDatabaseConnectionError(exception)) {
      this.logger.error(
        'No se pudo establecer conexión con PostgreSQL.',
        errorStack,
      );

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
    }

    // 4. Cualquier otra excepción inesperada
    this.logger.error(
      'Unhandled exception caught by global filter:',
      errorStack,
    );

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}

