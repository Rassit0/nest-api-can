import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake';
import type { BufferOptions, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as path from 'path';

const fonts = {
  OpenSans: {
    normal: path.join(process.cwd(), 'dist', 'fonts', 'OpenSans-Regular.ttf'),
    bold: path.join(process.cwd(), 'dist', 'fonts', 'OpenSans-ExtraBold.ttf'),
    italics: path.join(process.cwd(), 'dist', 'fonts', 'OpenSans-Italic.ttf'),
    bolditalics: path.join(
      process.cwd(),
      'dist',
      'fonts',
      'OpenSans-ExtraBoldItalic.ttf',
    ),
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
