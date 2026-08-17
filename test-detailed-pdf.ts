import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DetailedAccountingReport } from './src/reports/accounting/detailed/detailed-accounting.report';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const report = app.get(DetailedAccountingReport);
  
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

  console.log(`Generating report from ${start} to ${end}`);
  
  try {
    const pdfBuffer = await report.generate({ start, end }, 'pdf');
    fs.writeFileSync('test_detailed_report.pdf', pdfBuffer);
    console.log('PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
  }

  await app.close();
}

bootstrap();
