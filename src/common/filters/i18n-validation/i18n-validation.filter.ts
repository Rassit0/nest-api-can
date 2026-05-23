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

    const flattenErrors = (errs: any[], parentPath = '') => {
      errs.forEach((err) => {
        const currentPath = parentPath
          ? `${parentPath}.${err.property}`
          : err.property;

        // ✅ SOLO si hay errores reales
        if (err.constraints && Object.keys(err.constraints).length > 0) {
          if (!formattedErrors[currentPath]) {
            formattedErrors[currentPath] = [];
          }

          formattedErrors[currentPath].push(
            ...(Object.values(err.constraints) as string[]),
          );
        }

        // 🔁 seguir recorriendo hijos
        if (err.children && err.children.length > 0) {
          flattenErrors(err.children, currentPath);
        }
      });
    };

    flattenErrors(errors);

    response.status(400).json({
      message: 'Error en la validación',
      statusCode: 400,
      errors: formattedErrors,
    });
  }
}
