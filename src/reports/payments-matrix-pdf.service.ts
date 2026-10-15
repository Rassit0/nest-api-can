import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Content } from 'pdfmake/interfaces';
import { PaymentsMatrixService } from './payments-matrix.service';
import { PrinterService } from 'src/printer/printer.service';
import { PdfReportBuilder } from './core/builders/pdf-report.builder';
import { PaymentsMatrixResponseDto } from './dto/payments-matrix.dto';
import { envs } from 'src/config/envs';

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
    issuedAt?: string,
  ): Promise<PDFKit.PDFDocument> {
    const dto = await this.paymentsMatrixService.getCourseSeasonShiftMatrix(
      institutionId,
      shiftId,
    );
    return this.buildPdf(dto, userName, issuedAt);
  }

  async generateTeamSeasonPdf(
    institutionId: string,
    teamSeasonId: string,
    userName: string = 'Sistema',
    teamSeasonCategoryId?: string,
    issuedAt?: string,
  ): Promise<PDFKit.PDFDocument> {
    const dto = await this.paymentsMatrixService.getTeamSeasonMatrix(
      institutionId,
      teamSeasonId,
      teamSeasonCategoryId,
    );
    return this.buildPdf(dto, userName, issuedAt);
  }

  private buildPdf(
    dto: PaymentsMatrixResponseDto,
    userName: string,
    issuedAt?: string,
  ): PDFKit.PDFDocument {
    const builder = new PdfReportBuilder('Matriz de Control de Pagos', {
      pageOrientation: 'landscape',
      pageSize: 'LETTER',
      pageMargins: [15, 20, 15, 20],
    });

    builder.addContent(this.buildHeader(dto, userName, issuedAt));

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
        builder.addContent(this.buildCompactHeader(dto));
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
        row.push({ text: student.name, fontSize: 6.5, bold: true, margin: [0, 1, 0, 1] });

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
              fontSize: 7.5,
              margin: [0, 0, 0, 1]
            });

            rSortedPayments.forEach(p => {
              const chargeLabel = getChargeLabelAbbr(p.chargeType as string);
              rStackItems.push({ text: `${p.amount} ${chargeLabel}`, fontSize: 6, margin: [0, 0.5, 0, 0] });
              
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
                rStackItems.push({ text: receiptLine, fontSize: 5.5, color: 'gray', margin: [0, 0, 0, 0] });
              }
            });

            row.push({
              stack: rStackItems,
              margin: [0, 0.5, 0, 0.5],
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
              fontSize: 7.5,
              margin: [0, 0, 0, 1]
            });

            sortedPayments.forEach(p => {
              const chargeLabel = getChargeLabelAbbr(p.chargeType as string);
              stackItems.push({ text: `${p.amount} ${chargeLabel}`, fontSize: 6, margin: [0, 0.5, 0, 0] });
              
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
                stackItems.push({ text: receiptLine, fontSize: 5.5, color: 'gray', margin: [0, 0, 0, 0] });
              }
            });

            row.push({
              stack: stackItems,
              margin: [0, 0.5, 0, 0.5],
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
            fontSize: 7.5,
            alignment: 'center',
            margin: [0, 1, 0, 1],
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
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 1.5,
          paddingBottom: () => 1.5,
        }
      });
    });

    const docDefinition = builder.build();
    docDefinition.styles = {
      ...docDefinition.styles,
      subheader: {
        fontSize: 9,
        bold: true,
        margin: [0, 3, 0, 2],
        color: '#1F4E79',
      },
      tableExample: {
        margin: [0, 1, 0, 6],
      },
      tableHeader: {
        bold: true,
        fontSize: 6.5,
        color: '#1F4E79',
        fillColor: '#F5F8FA',
      },
    };

    return this.printer.createPdf(docDefinition);
  }

  private buildHeader(
    dto: PaymentsMatrixResponseDto,
    userName: string,
    issuedAt?: string,
  ): Content {
    const distLogo = path.join(process.cwd(), 'dist', 'assets', 'logo-can.png');
    const srcLogo = path.join(process.cwd(), 'src', 'assets', 'logo-can.png');
    const logoPath = fs.existsSync(distLogo)
      ? distLogo
      : fs.existsSync(srcLogo)
        ? srcLogo
        : null;

    const rawDate = issuedAt ? new Date(issuedAt) : new Date();
    const formattedDate = new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: envs.appTimezone,
    }).format(rawDate);

    const logoCell: any = logoPath
      ? {
          image: logoPath,
          width: 26,
          margin: [0, 0, 5, 0],
          border: [false, false, false, false],
        }
      : {
          text: '',
          width: 0,
          border: [false, false, false, false],
        };

    const groupTypeLabel =
      dto.group.type === 'COURSE_SEASON_SHIFT' ? 'TURNO / CURSO' : 'EQUIPO';
    const groupName = dto.group.name;
    const groupCategory =
      dto.group.category ||
      (dto.group.type === 'COURSE_SEASON_SHIFT'
        ? 'General'
        : 'Todas las categorías');

    return {
      table: {
        widths: logoPath ? ['auto', '*', 'auto'] : ['*', 'auto'],
        body: [
          [
            ...(logoPath ? [logoCell] : []),
            {
              stack: [
                {
                  text: 'CLUB ATLÉTICO NACIONAL',
                  bold: true,
                  fontSize: 9.5,
                  color: '#1F4E79',
                },
                {
                  text: 'CONTROL DE PAGOS',
                  bold: true,
                  fontSize: 8.5,
                  color: '#333333',
                  margin: [0, 0.5, 0, 0.5],
                },
                {
                  text: 'CAN Oruro · Oruro - BOLIVIA',
                  fontSize: 6.5,
                  color: '#555555',
                },
              ],
              margin: [0, 0, 0, 0],
              border: [false, false, false, false],
              alignment: 'left',
            },
            {
              stack: [
                {
                  text: `${groupTypeLabel}: ${groupName}`,
                  fontSize: 7.5,
                  bold: true,
                  alignment: 'right',
                  color: '#1F4E79',
                },
                {
                  text: `CATEGORÍA: ${groupCategory}`,
                  fontSize: 7.5,
                  bold: true,
                  alignment: 'right',
                },
                {
                  text: `GENERADO POR: ${userName}`,
                  fontSize: 6,
                  color: '#555555',
                  alignment: 'right',
                },
                {
                  text: `FECHA DE EMISIÓN: ${formattedDate}`,
                  fontSize: 6,
                  color: '#555555',
                  alignment: 'right',
                },
              ],
              margin: [0, 0, 0, 0],
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: function (i, node) {
          return i === node.table.body.length ? 1 : 0;
        },
        vLineWidth: function () {
          return 0;
        },
        hLineColor: function () {
          return '#1F4E79';
        },
        paddingTop: () => 0,
        paddingBottom: () => 1.5,
      },
      margin: [0, 0, 0, 3],
    };
  }

  private buildCompactHeader(dto: PaymentsMatrixResponseDto): Content {
    const groupName = dto.group.name;
    const groupCategory = dto.group.category ? ` - ${dto.group.category}` : '';

    return {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: `CLUB ATLÉTICO NACIONAL · CONTROL DE PAGOS · ${groupName}${groupCategory}`,
              fontSize: 7,
              bold: true,
              color: '#1F4E79',
              border: [false, false, false, false],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: function (i, node) {
          return i === node.table.body.length ? 1 : 0;
        },
        vLineWidth: function () {
          return 0;
        },
        hLineColor: function () {
          return '#1F4E79';
        },
        paddingTop: () => 0,
        paddingBottom: () => 1.5,
      },
      margin: [0, 0, 0, 3],
    };
  }
}

