import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import { GeneralAccountingReport } from './src/reports/accounting/general/general-accounting.report';

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const report = moduleRef.get(GeneralAccountingReport);
  
  // We'll mock the printer to just return the docDefinition so we can inspect it
  const docDef = await report.generate({ start: '2026-08-01', end: '2026-08-31' }, 'pdf');
  
  // But wait, the generate method returns a PDF stream from printerService.
  // We can just get the summary data directly from analytics.
  const analytics = moduleRef.get('AccountingAnalyticsService');
  const data = await analytics.getAccountingSummary({ start: '2026-08-01', end: '2026-08-31' });
  
  console.log('Transfers returned by analytics:', data.transfers);
}

main().catch(console.error).finally(() => process.exit(0));
