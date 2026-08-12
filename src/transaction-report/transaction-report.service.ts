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

  async getTransactionByIdReport(transactionId: string, isSingle: boolean = false) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        payerPerson: true,
        createdBy: {
          include: { person: true },
        },
        payment: {
          include: {
            charge: {
              include: {
                membershipCharges: {
                  include: {
                    playerMembership: {
                      include: { player: { include: { person: true } } },
                    },
                  },
                },
                studentCharges: {
                  include: {
                    studentMembership: {
                      include: { student: { include: { person: true } } },
                    },
                  },
                },
              },
            },
          },
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

    // Determinar si hay un beneficiario (jugador o estudiante)
    let beneficiaryName: string | undefined;
    if (
      transaction.payment &&
      transaction.payment.charge
    ) {
      const charge = transaction.payment.charge;
      if (charge.membershipCharges && charge.membershipCharges.length > 0) {
        const person =
          charge.membershipCharges[0].playerMembership.player.person;
        beneficiaryName =
          `${person.name} ${person.lastName} ${person.secondLastName || ''}`.trim();
      } else if (charge.studentCharges && charge.studentCharges.length > 0) {
        const person =
          charge.studentCharges[0].studentMembership.student.person;
        beneficiaryName =
          `${person.name} ${person.lastName} ${person.secondLastName || ''}`.trim();
      }
    }

    const lang = I18nContext.current()?.lang || 'es';
    const translatedPaymentMethod = this.i18n.translate(
      `fields.paymentMethods.${transaction.paymentMethod}`,
      { lang },
    );

    const data = {
      receiptSeries: transaction.receiptSeries,
      receiptNumber,
      date: transaction.transactionDate,
      payerName,
      payerDocument,
      beneficiaryName,
      amountLiteral,
      amountNumeric: numericAmount.toFixed(2),
      concept: transaction.description || 'Sin concepto',
      paymentMethod: translatedPaymentMethod,
      receiverName,
      receiverDocument,
      validationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify/${transaction.id}`,
      type: transaction.type,
    };

    const docDefinition = transactionByIdReport({ data, isSingle });

    const doc = this.printerService.createPdf(docDefinition);

    return doc;
  }
}
