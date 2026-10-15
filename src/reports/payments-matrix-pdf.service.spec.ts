import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsMatrixPdfService } from './payments-matrix-pdf.service';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PrinterService } from 'src/printer/printer.service';
import { PaymentsMatrixResponseDto } from './dto/payments-matrix.dto';
import { PdfReportBuilder } from './core/builders/pdf-report.builder';

describe('PaymentsMatrixPdfService', () => {
  let service: PaymentsMatrixPdfService;
  let matrixService: jest.Mocked<PaymentsMatrixService>;
  let printerService: jest.Mocked<PrinterService>;

  const mockDto: PaymentsMatrixResponseDto = {
    group: {
      id: 'ts-123',
      name: 'CAN Básquetbol Mayores',
      type: 'TEAM_SEASON',
      category: 'Primera / Mayores',
    },
    periods: [
      {
        key: '2026-10',
        label: 'Octubre 2026',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-10-31T23:59:59.000Z',
      },
    ],
    students: [
      {
        id: 'std-1',
        name: 'MAMANI PEREZ JUAN',
        registration: {
          totalPaid: 150,
          payments: [
            {
              amount: 150,
              date: '2026-10-02T10:00:00.000Z',
              receiptNumber: 'A-00100',
              chargeType: 'REGISTRATION',
            },
          ],
        },
        paymentsByPeriod: {
          '2026-10': {
            totalPaid: 200,
            payments: [
              {
                amount: 200,
                date: '2026-10-05T10:00:00.000Z',
                receiptNumber: 'A-00105',
                chargeType: 'RECURRING_FEE',
              },
            ],
          },
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsMatrixPdfService,
        {
          provide: PaymentsMatrixService,
          useValue: {
            getTeamSeasonMatrix: jest.fn().mockResolvedValue(mockDto),
            getCourseSeasonShiftMatrix: jest.fn(),
          },
        },
        {
          provide: PrinterService,
          useValue: {
            createPdf: jest.fn().mockReturnValue({} as any),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsMatrixPdfService>(PaymentsMatrixPdfService);
    matrixService = module.get(PaymentsMatrixService);
    printerService = module.get(PrinterService);
  });

  it('should generate team season PDF with institutional header and no leading blank cover page', async () => {
    await service.generateTeamSeasonPdf(
      'inst-1',
      'ts-123',
      'Test User',
      'cat-456',
    );

    expect(matrixService.getTeamSeasonMatrix).toHaveBeenCalledWith(
      'inst-1',
      'ts-123',
      'cat-456',
    );

    expect(printerService.createPdf).toHaveBeenCalledTimes(1);
    const docDef = printerService.createPdf.mock.calls[0][0];

    // Assert orientation and page settings
    expect(docDef.pageOrientation).toBe('landscape');
    expect(docDef.pageSize).toBe('LETTER');

    // Assert that the first content element is the institutional header table
    const firstContent: any = docDef.content[0];
    expect(firstContent).toBeDefined();
    expect(firstContent.table).toBeDefined();
    // Verify no forced page break after first element
    expect(firstContent.pageBreak).toBeUndefined();

    // Verify institutional club text inside the header
    const headerJson = JSON.stringify(firstContent);
    expect(headerJson).toContain('CLUB ATLÉTICO NACIONAL');
    expect(headerJson).toContain('CONTROL DE PAGOS');
    expect(headerJson).toContain('EQUIPO: CAN Básquetbol Mayores');
    expect(headerJson).toContain('CATEGORÍA: Primera / Mayores');

    // Verify that the table title and data immediately follow on the first page
    const secondContent: any = docDef.content[1];
    expect(secondContent).toBeDefined();
    expect(JSON.stringify(secondContent)).toContain('Detalle de Pagos');

    const thirdContent: any = docDef.content[2];
    expect(thirdContent).toBeDefined();
    expect(JSON.stringify(thirdContent)).toContain('MAMANI PEREZ JUAN');

    // Verify isolated institutional tableHeader style in PaymentsMatrixPdfService
    const styles: any = docDef.styles;
    expect(styles?.tableHeader?.color).toBe('#1F4E79');
    expect(styles?.tableHeader?.fillColor).toBe('#F5F8FA');
  });

  it('should verify that PdfReportBuilder preserves its default black/#f2f2f2 tableHeader style', () => {
    const builder = new PdfReportBuilder('Default Test Report');
    const docDef = builder.build();
    const styles: any = docDef.styles;

    expect(styles?.tableHeader?.color).toBe('black');
    expect(styles?.tableHeader?.fillColor).toBe('#f2f2f2');
  });
});
