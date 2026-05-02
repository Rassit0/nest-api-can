import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { I18nValidationException } from 'nestjs-i18n';

@Catch(I18nValidationException)
export class I18nValidationFilter implements ExceptionFilter {
  catch(exception: I18nValidationException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const errors = exception.errors;

    const formattedErrors: Record<string, string[]> = {};

    const formatErrors = (errs: any[]) => {
      errs.forEach((err) => {
        if (err.constraints) {
          formattedErrors[err.property] = Object.values(err.constraints);
        }

        // 🔥 Manejo de errores anidados (muy importante)
        if (err.children && err.children.length > 0) {
          formatErrors(err.children);
        }
      });
    };

    formatErrors(errors);

    response.status(400).json({
      message: 'Error en la validación',
      statusCode: 400,
      errors: formattedErrors,
    });
  }
}
