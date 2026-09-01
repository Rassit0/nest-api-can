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
    teamSeasonCategoryId?: string,
  ): Promise<PDFKit.PDFDocument> {
    const dto = await this.paymentsMatrixService.getTeamSeasonMatrix(
      institutionId,
      teamSeasonId,
      teamSeasonCategoryId,
    );
    return this.buildPdf(dto, userName);
  }

  private buildPdf(
    dto: PaymentsMatrixResponseDto,
    userName: string,
  ): PDFKit.PDFDocument {
    const builder = new PdfReportBuilder('Matriz de Control de Pagos', {
      pageOrientation: 'landscape',
      pageSize: 'LETTER',
      pageMargins: [15, 20, 15, 20],
    });

    const groupName = dto.group.name;
    const groupCategory = dto.group.category ? ` - ${dto.group.category}` : '';

    builder.addCover({
      title: 'Control de Pagos',
      subtitle: `${groupName}${groupCategory}`,
      generatedBy: userName,
      date: new Date().toLocaleDateString('es-BO'),
    });

    const MAX_COLUMNS = 7;
    const periodChunks = [];
    const firstChunkSize = 6;
    if (dto.periods.length > 0) {
      periodChunks.push(dto.periods.slice(0, firstChunkSize));
      for (let i = firstChunkSize; i < dto.periods.length; i += MAX_COLUMNS) {
        periodChunks.push(dto.periods.slice(i, i + MAX_COLUMNS));
      }
    } else {
      periodChunks.push([]);
    }

    const getChargeLabelAbbr = (type: string) => {
      switch (type) {
        case 'RECURRING_FEE': return 'Cuota';
        case 'LATE_FEE': return 'Mora';
        case 'REGISTRATION': return 'Matríc.';
        case 'MANUAL': return 'Man.';
        default: return type;
      }
    };

    periodChunks.forEach((chunk, index) => {
      if (index > 0) {
        builder.addPageBreak();
      }

      const isFirstChunk = index === 0;
      const isLastChunk = index === periodChunks.length - 1;
      
      const headers = ['Estudiante'];
      if (isFirstChunk) headers.push('Matrícula');
      headers.push(...chunk.map((p) => p.label));
      if (isLastChunk) headers.push('Total General');
      
      const widths: any[] = [85];
      if (isFirstChunk) widths.push('*');
      widths.push(...chunk.map(() => '*'));
      if (isLastChunk) widths.push('*');
      
      const rows: any[][] = [];

      dto.students.forEach((student) => {
        const row: any[] = [];
        row.push({ text: student.name, fontSize: 7, bold: true, margin: [0, 3, 0, 3] });

        if (isFirstChunk) {
          if (!student.registration || student.registration.totalPaid === 0) {
            row.push('');
          } else {
            const rData = student.registration;
            const rSortedPayments = [...rData.payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const rStackItems: any[] = [];
            
            rStackItems.push({
              text: rData.totalPaid.toString(),
              bold: true,
              fontSize: 8,
              margin: [0, 0, 0, 4]
            });

            rSortedPayments.forEach(p => {
              const chargeLabel = getChargeLabelAbbr(p.chargeType as string);
              rStackItems.push({ text: `${p.amount} ${chargeLabel}`, fontSize: 7, margin: [0, 2, 0, 0] });
              
              let receiptLine = p.receiptNumber || '';
              if (p.date) {
                if (receiptLine) receiptLine += ' · ';
                const dateObj = new Date(p.date);
                const day = dateObj.getUTCDate().toString().padStart(2, '0');
                const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
                const year = dateObj.getUTCFullYear().toString().slice(-2);
                receiptLine += `${day}/${month}/${year}`;
              }
              
              if (receiptLine) {
                rStackItems.push({ text: receiptLine, fontSize: 6, color: 'gray', margin: [0, 0, 0, 2] });
              }
            });

            row.push({
              stack: rStackItems,
              margin: [0, 2, 0, 2],
              alignment: 'center'
            });
          }
        }

        chunk.forEach((period) => {
          const periodData = student.paymentsByPeriod[period.key];

          if (!periodData || periodData.totalPaid === 0) {
            row.push('');
          } else {
            const sortedPayments = [...periodData.payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const stackItems: any[] = [];
            
            stackItems.push({
              text: periodData.totalPaid.toString(),
              bold: true,
              fontSize: 8,
              margin: [0, 0, 0, 4]
            });

            sortedPayments.forEach(p => {
              const chargeLabel = getChargeLabelAbbr(p.chargeType as string);
              stackItems.push({ text: `${p.amount} ${chargeLabel}`, fontSize: 7, margin: [0, 2, 0, 0] });
              
              let receiptLine = p.receiptNumber || '';
              
              if (p.date) {
                if (receiptLine) receiptLine += ' · ';
                const dateObj = new Date(p.date);
                const day = dateObj.getUTCDate().toString().padStart(2, '0');
                const month = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
                const year = dateObj.getUTCFullYear().toString().slice(-2);
                receiptLine += `${day}/${month}/${year}`;
              }
              
              if (receiptLine) {
                stackItems.push({ text: receiptLine, fontSize: 6, color: 'gray', margin: [0, 0, 0, 2] });
              }
            });

            row.push({
              stack: stackItems,
              margin: [0, 2, 0, 2],
              alignment: 'center'
            });
          }
        });

        if (isLastChunk) {
          const grandTotal = (student.registration?.totalPaid ?? 0) + Object.values(student.paymentsByPeriod).reduce(
            (sum, pData) => sum + pData.totalPaid,
            0
          );
          row.push({
            text: grandTotal.toString(),
            bold: true,
            fontSize: 7,
            alignment: 'center',
            margin: [0, 2, 0, 2],
            color: 'green'
          });
        }

        rows.push(row);
      });

      if (rows.length === 0) {
         rows.push([{ text: 'No hay estudiantes registrados.', colSpan: headers.length, alignment: 'center' }, ...headers.slice(1).map(() => '')]);
      }

      builder.addDataTable({
        title: index === 0 ? 'Detalle de Pagos' : `Detalle de Pagos (Continuación ${index + 1})`,
        headers,
        widths,
        rows,
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cccccc',
          vLineColor: () => '#cccccc',
          paddingLeft: () => 4,
          paddingRight: () => 4
        }
      });
    });

    const docDefinition = builder.build();
    
    // Add page break logic via header repetitions?
    // pdfMake automatically repeats table headers on new pages if headerRows: 1 is used in addDataTable.
    // addDataTable already specifies `headerRows: 1` in pdf-report.builder.ts.

    return this.printer.createPdf(docDefinition);
  }
}
