import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { I18nValidationFilter } from './common/filters/i18n-validation/i18n-validation.filter';
import { useContainer } from 'class-validator';
import { PrismaExceptionFilter } from './common/filters/prisma/prisma-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('API Gestión 360')
    .setDescription('Documentación de la API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Habilitar CORS
  app.enableCors({
    origin: 'http://localhost:3000', // El puerto de tu frontend
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });


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
