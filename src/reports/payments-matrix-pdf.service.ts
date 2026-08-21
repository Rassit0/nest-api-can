import { Injectable } from '@nestjs/common';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PrinterService } from 'src/printer/printer.service';
import { PdfReportBuilder } from './core/builders/pdf-report.builder';
import { PaymentsMatrixResponseDto } from './dto/payments-matrix.dto';

@Injectable()
export class PaymentsMatrixPdfService {
  constructor(
    private readonly paymentsMatrixService: PaymentsMatrixService,
    private readonly printer: PrinterService,
  ) {}

  async generateCourseSeasonShiftPdf(
    institutionId: string,
    shiftId: string,
    userName: string = 'Sistema',
  ): Promise<PDFKit.PDFDocument> {
    const dto = await this.paymentsMatrixService.getCourseSeasonShiftMatrix(
      institutionId,
      shiftId,
    );
    return this.buildPdf(dto, userName);
  }

  async generateTeamSeasonPdf(
    institutionId: string,
    teamSeasonId: string,
    userName: string = 'Sistema',
  ): Promise<PDFKit.PDFDocument> {
    const dto = await this.paymentsMatrixService.getTeamSeasonMatrix(
      institutionId,
      teamSeasonId,
    );
    return this.buildPdf(dto, userName);
  }

  private buildPdf(
    dto: PaymentsMatrixResponseDto,
    userName: string,
  ): PDFKit.PDFDocument {
    const builder = new PdfReportBuilder('Matriz de Control de Pagos', {
      pageOrientation: 'landscape',
    });

    const groupName = dto.group.name;
    const groupCategory = dto.group.category ? ` - ${dto.group.category}` : '';

    builder.addCover({
      title: 'Control de Pagos',
      subtitle: `${groupName}${groupCategory}`,
      generatedBy: userName,
      date: new Date().toLocaleDateString('es-BO'),
    });

    const headers = ['Estudiante', ...dto.periods.map((p) => p.label)];
    // Ensure the first column (Estudiante) has more width.
    const widths = ['auto', ...dto.periods.map(() => '*')];

    const rows: any[][] = [];

    dto.students.forEach((student) => {
      const row: any[] = [];
      row.push({ text: student.name, fontSize: 10, bold: true, margin: [0, 5, 0, 5] });

      dto.periods.forEach((period) => {
        const periodData = student.paymentsByPeriod[period.key];

        if (!periodData || periodData.totalPaid === 0) {
          row.push('');
        } else {
          // Use native pdfMake stack for better styling.
          // Get the latest payment date to display.
          const sortedPayments = [...periodData.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastPaymentDate = sortedPayments.length > 0 ? sortedPayments[0].date : null;
          
          let dateText = '';
          if (lastPaymentDate) {
            const dateObj = new Date(lastPaymentDate);
            // Format as DD-MM
            dateText = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
          }

          row.push({
            stack: [
              { text: periodData.totalPaid.toString(), bold: true, fontSize: 10 },
              { text: dateText, fontSize: 8, color: 'gray' }
            ],
            margin: [0, 2, 0, 2],
            alignment: 'center'
          });
        }
      });

      rows.push(row);
    });

    if (rows.length === 0) {
       rows.push([{ text: 'No hay estudiantes registrados.', colSpan: headers.length, alignment: 'center' }, ...headers.slice(1).map(() => '')]);
    }

    // Pass the headers, rows, and widths to the builder.
    builder.addDataTable({
      title: 'Detalle de Pagos',
      headers,
      widths,
      rows,
    });

    const docDefinition = builder.build();
    
    // Add page break logic via header repetitions?
    // pdfMake automatically repeats table headers on new pages if headerRows: 1 is used in addDataTable.
    // addDataTable already specifies `headerRows: 1` in pdf-report.builder.ts.

    return this.printer.createPdf(docDefinition);
  }
}
