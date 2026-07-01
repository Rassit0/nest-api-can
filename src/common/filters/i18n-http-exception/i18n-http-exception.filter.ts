import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Catch(HttpException)
export class I18nHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18n: I18nService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    const lang = I18nContext.current(host)?.lang || 'es';

    let message = exception.message;
    let errors = undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      if (Array.isArray(exceptionResponse.message)) {
        message = exceptionResponse.message[0];
      } else if (exceptionResponse.message) {
        message = exceptionResponse.message;
      }
      if (exceptionResponse.errors) {
        errors = exceptionResponse.errors;
      }
    }

    let translatedMessage = message;
    if (message && (message.includes('.') || !message.includes(' '))) {
      try {
        const translation = this.i18n.translate(message, {
          lang,
          defaultValue: message,
        }) as string;
        if (translation && translation !== message) {
          translatedMessage = translation;
        }
      } catch (e) {
        // Fallback to original
      }
    }

    response.status(status).json({
      statusCode: status,
      message: translatedMessage,
      errors: errors,
    });
  }
}
