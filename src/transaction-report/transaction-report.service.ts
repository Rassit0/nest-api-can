import { Injectable, NotFoundException } from '@nestjs/common';
import { PrinterService } from 'src/printer/printer.service';
import { transactionByIdReport } from 'src/reports';
import { convertAmountToWords } from 'src/helpers/numbers-to-words.helper';
import type { PageSize } from 'pdfmake/interfaces';
import { PrismaService } from 'src/prisma.service';
import { I18nService, I18nContext } from 'nestjs-i18n';

@Injectable()
export class TransactionReportService {
  constructor(
    private readonly printerService: PrinterService,
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  async getTransactionByIdReport(transactionId: string, pageSize?: PageSize) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payerPerson: true,
        createdBy: {
          include: { person: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with id ${transactionId} not found`,
      );
    }

    // Format unique receipt number from autoincrement sequence
    const year = transaction.transactionDate.getFullYear();
    const paddedNumber = transaction.receiptNumber.toString().padStart(7, '0');
    const receiptNumber = `${paddedNumber}/${year}`;

    // Format amount
    const numericAmount = transaction.amount.toNumber();
    const amountLiteral = convertAmountToWords(numericAmount);

    // Format payer name and document
    const payerName = transaction.payerPerson
      ? `${transaction.payerPerson.name} ${transaction.payerPerson.lastName}`
      : 'No especificado';
    const payerDocument = transaction.payerPerson
      ? transaction.payerPerson.documentNumber
      : 'S/N';

    // Format receiver name and document
    const receiverPerson = transaction.createdBy?.person;
    const receiverName = receiverPerson
      ? `${receiverPerson.name} ${receiverPerson.lastName}`
      : 'Usuario del Sistema';
    const receiverDocument = receiverPerson
      ? receiverPerson.documentNumber
      : 'S/N';

    const lang = I18nContext.current()?.lang || 'es';
    const translatedPaymentMethod = this.i18n.translate(
      `fields.paymentMethods.${transaction.paymentMethod}`,
      { lang },
    );

    const data = {
      receiptNumber,
      date: transaction.transactionDate,
      payerName,
      payerDocument,
      amountLiteral,
      amountNumeric: numericAmount.toFixed(2),
      concept: transaction.description || 'Sin concepto',
      paymentMethod: translatedPaymentMethod,
      receiverName,
      receiverDocument,
      validationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${transaction.id}`,
    };

    const docDefinition = transactionByIdReport({ data, pageSize });

    const doc = this.printerService.createPdf(docDefinition);

    return doc;
  }
}
