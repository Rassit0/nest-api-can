import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PaymentsMatrixService } from './src/reports/payments-matrix.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(PaymentsMatrixService);
  
  // Hardcode an institutionId
  const institutionId = 'some-id'; // I will get it from DB
  
  console.log('App initialized');
  process.exit(0);
}

bootstrap().catch(console.error);
