import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DetailedAccountingReport } from './src/reports/accounting/detailed/detailed-accounting.report';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  console.log('Bootstrapping app to test DetailedAccountingReport...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const report = app.get(DetailedAccountingReport);
  console.log('Got report instance. Generating...');

  const params = {
    start: '2020-01-01T00:00:00.000Z',
    end: '2026-10-31T23:59:59.000Z'
  };

  const pdfDoc = await report.generate(params, 'pdf');
  
  const chunks: Buffer[] = [];
  pdfDoc.on('data', (chunk) => chunks.push(chunk));
  pdfDoc.on('end', () => {
    const result = Buffer.concat(chunks);
    const outputPath = path.join(__dirname, 'test-report.pdf');
    fs.writeFileSync(outputPath, result);
    console.log(`PDF successfully written to ${outputPath}`);
    process.exit(0);
  });
  
  pdfDoc.end();
}

bootstrap().catch(e => {
  console.error(e);
  process.exit(1);
});
