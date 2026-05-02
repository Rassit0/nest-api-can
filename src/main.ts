import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { I18nValidationFilter } from './common/filters/i18n-validation/i18n-validation.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // ✅ ÚNICO pipe (con i18n)
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ✅ Tu filtro personalizado (el que creaste)
  app.useGlobalFilters(new I18nValidationFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
