import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { JwtService } from '@nestjs/jwt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const jwtService = app.get(JwtService);
  
  const payload = { sub: 'ba778394-85b7-4689-81c7-61cfcc7a7819', email: 'admin@gestion360.com', roles: ['ADMIN'] };
  const token = jwtService.sign(payload);
  console.log('TOKEN:', token);
  
  await app.close();
}
bootstrap();
