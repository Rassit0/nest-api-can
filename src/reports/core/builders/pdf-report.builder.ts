import * as pdfMake from 'pdfmake/build/pdfmake';
import type {
  TDocumentDefinitions,
  Content,
  StyleDictionary,
  Margins,
  TableCell,
} from 'pdfmake/interfaces';

export class PdfReportBuilder {
  private content: Content[] = [];
  private styles: StyleDictionary = {
    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
    subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
    tableExample: { margin: [0, 5, 0, 15] },
    tableHeader: {
      bold: true,
      fontSize: 11,
      color: 'black',
      fillColor: '#f2f2f2',
    },
    summaryCard: { margin: [0, 5, 0, 15], fillColor: '#fafafa' },
    notes: { fontSize: 9, italics: true, color: 'gray' },
  };

  private title: string;
  private pageOrientation: 'portrait' | 'landscape' = 'portrait';

  constructor(title: string, options?: { pageOrientation?: 'portrait' | 'landscape' }) {
    this.title = title;
    if (options?.pageOrientation) {
      this.pageOrientation = options.pageOrientation;
    }
  }

  addCover(data: {
    title: string;
    subtitle?: string;
    dateRange?: string;
    generatedBy?: string;
    date?: string;
  }) {
    this.content.push({
      stack: [
        {
          text: 'CLUB ATLÉTICO NACIONAL (CAN)',
          style: 'header',
          alignment: 'center',
          margin: [0, 50, 0, 10],
        },
        { text: data.title, style: 'header', alignment: 'center' },
        ...(data.subtitle
          ? [
              {
                text: data.subtitle,
                style: 'subheader',
                alignment: 'center',
              } as Content,
            ]
          : []),
        ...(data.dateRange
          ? [
              {
                text: `Período: ${data.dateRange}`,
                alignment: 'center',
                margin: [0, 20, 0, 0],
              } as Content,
            ]
          : []),
        { text: '\n\n\n\n\n' },
        ...(data.generatedBy
          ? [
              {
                text: `Generado por: ${data.generatedBy}`,
                alignment: 'center',
                margin: [0, 5, 0, 0],
              } as Content,
            ]
          : []),
        ...(data.date
          ? [
              {
                text: `Fecha de emisión: ${data.date}`,
                alignment: 'center',
              } as Content,
            ]
          : []),
      ],
      pageBreak: 'after',
    });
    return this;
  }

  addExecutiveSummary(
    kpis: {
      label: string;
      value: string | number;
      format?: 'currency' | 'number';
    }[],
  ) {
    this.content.push({ text: 'Resumen Ejecutivo', style: 'subheader' });

    const columns = kpis.map((kpi) => ({
      stack: [
        { text: kpi.label, fontSize: 10, color: 'gray' },
        { text: kpi.value.toString(), fontSize: 14, bold: true },
      ],
      margin: [0, 10, 0, 10] as Margins,
      fillColor: '#f9f9f9',
      padding: [10, 10, 10, 10], // pdfmake doesn't have padding natively in columns, but tables do. We'll use a table for the summary cards.
    }));

    // For better styling in pdfmake, cards are usually 1-row tables with no borders
    const body: TableCell[][] = [
      kpis.map((kpi) => ({
        stack: [
          {
            text: kpi.label,
            fontSize: 10,
            color: 'gray',
            margin: [0, 0, 0, 5] as Margins,
          },
          { text: kpi.value.toString(), fontSize: 14, bold: true },
        ],
        fillColor: '#f3f4f6',
        margin: [5, 5, 5, 5] as Margins,
        border: [false, false, false, false],
      })),
    ];

    this.content.push({
      table: {
        widths: kpis.map(() => '*'),
        body,
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 20],
    });

    return this;
  }

  addDataTable(data: {
    title?: string;
    headers: string[];
    rows: any[][];
    widths?: string[];
  }) {
    if (data.title) {
      this.content.push({ text: data.title, style: 'subheader' });
    }

    const tableBody: any[][] = [];
    tableBody.push(
      data.headers.map((h) => ({ text: h, style: 'tableHeader' })),
    );
    data.rows.forEach((row) => {
      tableBody.push(row);
    });

    this.content.push({
      style: 'tableExample',
      table: {
        headerRows: 1,
        widths: data.widths || data.headers.map(() => '*'),
        body: tableBody,
      },
      layout: 'lightHorizontalLines',
    });

    return this;
  }

  addNotes(notes: string) {
    this.content.push({ text: notes, style: 'notes' });
    return this;
  }

  addPageBreak() {
    this.content.push({ text: '', pageBreak: 'after' });
    return this;
  }

  build(): TDocumentDefinitions {
    return {
      info: {
        title: this.title,
      },
      pageOrientation: this.pageOrientation,
      content: this.content,
      styles: this.styles,
      defaultStyle: {
        fontSize: 10,
      },
      footer: (currentPage, pageCount) => {
        return {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          margin: [0, 10, 0, 0],
        };
      },
    };
  }
}
