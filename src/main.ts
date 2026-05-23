import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { I18nValidationFilter } from './common/filters/i18n-validation/i18n-validation.filter';
import { useContainer } from 'class-validator';
import { PrismaExceptionFilter } from './common/filters/prisma/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Habilitar CORS
  app.enableCors({
    origin: 'http://localhost:3000', // El puerto de tu frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

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
  app.useGlobalFilters(
    new I18nValidationFilter(),
    app.get(PrismaExceptionFilter),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
