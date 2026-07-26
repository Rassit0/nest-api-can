import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { BufferOptions, TDocumentDefinitions } from 'pdfmake/interfaces';

const fonts = {
  OpenSans: {
    normal: 'fonts/OpenSans-Regular.ttf',
    bold: 'fonts/OpenSans-ExtraBold.ttf',
    italics: 'fonts/OpenSans-Italic.ttf',
    bolditalics: 'fonts/OpenSans-ExtraBoldItalic.ttf',
  },
};

@Injectable()
export class PrinterService {
  private printer = new PdfPrinter(fonts);

  createPdf(
    docDefinition: TDocumentDefinitions,
    options: BufferOptions = {},
  ): PDFKit.PDFDocument {
    docDefinition.defaultStyle = {
      font: 'OpenSans',
      ...docDefinition.defaultStyle,
    };
    const doc = this.printer.createPdfKitDocument(docDefinition, options);
    return doc;
  }
}
