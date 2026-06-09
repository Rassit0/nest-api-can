import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from 'src/generated/prisma/client';

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function normalizeField(field: string): string {
  return snakeToCamel(field);
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    console.log(
      this.i18n.translate('validation.ALREADY_EXISTS', {
        lang: 'es',
      }),
    );
    let errorResponse;
    switch (exception.code) {
      case 'P2025':
        errorResponse = new NotFoundException(
          this.i18n.t('validation.NOT_FOUND'),
        );
        break;

      case 'P2002': {
        const driverError = exception.meta?.driverAdapterError as any;
        const fields = driverError.cause.constraint.fields;
        // console.log({ fields });
        // 🔥 obtener campos únicos
        // const fields = (exception.meta?.target as string[]) || [];

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
          message: this.i18n.t('validation.ALREADY_EXISTS', {
            args: {
              entity: this.i18n.t(`fields.${normalizeField(fields[0])}`),
            },
          }),
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

        const errors = fields.reduce(
          (acc, f) => {
            acc[f] = [
              this.i18n.t('validation.NOT_FOUND_RELATION', {
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

      default:
        this.logger.error('Unhandled Prisma error', {
          code: exception.code,
          message: exception.message,
          meta: exception.meta,
          stack: exception.stack,
        });

        errorResponse = new InternalServerErrorException(
          this.i18n.t('validation.SERVER_ERROR'),
        );
    }

    response
      .status(errorResponse.getStatus())
      .json(errorResponse.getResponse());
  }
}
