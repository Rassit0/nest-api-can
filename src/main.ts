import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { I18nValidationPipe, I18nService } from 'nestjs-i18n';
import { I18nValidationFilter } from './common/filters/i18n-validation/i18n-validation.filter';
import { useContainer } from 'class-validator';
import { PrismaExceptionFilter } from './common/filters/prisma/prisma-exception.filter';
import { I18nHttpExceptionFilter } from './common/filters/i18n-http-exception/i18n-http-exception.filter';
import { GlobalFileFilter } from './common/filters/global-file.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { envs } from './config';

function getPackageVersion(): string {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const rawData = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(rawData) as unknown as { version?: string };
    return pkg?.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('API Gestión 360')
    .setDescription('Documentación de la API')
    .setVersion(getPackageVersion())
    .addTag('Authentication')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document);

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Habilitar CORS
  app.enableCors({
    origin: envs.frontendUrls, // Orígenes permitidos desde las variables de entorno
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

  const i18nService = app.get(I18nService);

  app.useGlobalFilters(
    new GlobalFileFilter(),
    new I18nHttpExceptionFilter(i18nService),
    app.get(PrismaExceptionFilter),
    new I18nValidationFilter(),
  );

  await app.listen(envs.port ?? 3000);
}
bootstrap();
