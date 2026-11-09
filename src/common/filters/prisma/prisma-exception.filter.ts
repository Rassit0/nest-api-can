import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from 'src/generated/prisma/client';
import { isDatabaseConnectionError } from '../database-error.util';

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function normalizeField(field: string): string {
  return snakeToCamel(field);
}

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientInitializationError
      | any,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Manejo explícito de fallos de inicialización o conexión de Prisma
    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception?.name === 'PrismaClientInitializationError'
    ) {
      this.logger.error(
        'No se pudo establecer conexión con PostgreSQL.',
        exception.stack || exception.message,
      );

      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
    }

    let errorResponse;
    switch (exception.code) {
      // Códigos conocidos de falla de conectividad en Prisma
      case 'P1000':
      case 'P1001':
      case 'P1002':
      case 'P1003':
      case 'P1017': {
        this.logger.error('No se pudo establecer conexión con PostgreSQL.', {
          code: exception.code,
          message: exception.message,
          stack: exception.stack,
        });

        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        });
      }

      case 'P2025':
        errorResponse = new NotFoundException(
          this.i18n.t('validation.NOT_FOUND'),
        );
        break;

      case 'P2002': {
        const driverError = exception.meta;
        const fields = driverError?.target as string[];

        const errors = fields.reduce(
          (acc, field) => {
            const prismaField = normalizeField(field);
            acc[prismaField] = [
              this.i18n.translate('validation.ALREADY_EXISTS', {
                args: {
                  entity: this.i18n.t(`fields.${prismaField}`),
                },
              }),
            ];
            return acc;
          },
          {} as Record<string, string[]>,
        );

        errorResponse = new ConflictException({
          message: 'Ya existe un registro con los datos proporcionados',
          statusCode: 409,
          errors,
        });

        break;
      }

      case 'P2003': {
        // 1. Obtenemos el nombre del índice/restricción del driver
        const driverError = exception.meta?.driverAdapterError as any;
        let field: string = driverError?.cause?.constraint?.index;

        // 2. Si no viene en el driver, extraemos del field_name de Prisma
        if (!field) {
          const fieldName = (exception.meta?.field_name as string) || '';
          const match = fieldName.match(/(\w+)_fkey/);
          field = match ? match[1] : 'id';
        }

        // 3. Como 'field' es un string, lo metemos en un array para que el resto de tu lógica funcione
        const fields = [normalizeField(field)];

        const requestMethod = ctx.getRequest<Request>().method;
        const i18nKey =
          requestMethod === 'DELETE'
            ? 'validation.RELATION_DEPENDENCY'
            : 'validation.NOT_FOUND_RELATION';

        const errors = fields.reduce(
          (acc, f) => {
            acc[f] = [
              this.i18n.t(i18nKey, {
                args: {
                  entity: this.i18n.t(`fields.${f}`),
                },
              }),
            ];
            return acc;
          },
          {} as Record<string, string[]>,
        );

        errorResponse = new BadRequestException({
          message: this.i18n.t('validation.RELATION_ERROR', {
            args: {
              entity: this.i18n.t(`fields.${fields[0]}`),
            },
          }),
          statusCode: 400,
          errors,
        });
        break;
      }

      default: {
        if (isDatabaseConnectionError(exception)) {
          this.logger.error('No se pudo establecer conexión con PostgreSQL.', {
            code: exception.code,
            message: exception.message,
            meta: exception.meta,
            stack: exception.stack,
          });
        } else {
          this.logger.error('Unhandled Prisma error', {
            code: exception.code,
            message: exception.message,
            meta: exception.meta,
            stack: exception.stack,
          });
        }

        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        });
      }
    }

    response
      .status(errorResponse.getStatus())
      .json(errorResponse.getResponse());
  }
}

