import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { InternalTransfersPaginationDto } from './dto/pagination.dto';
import {
  TransactionType,
  TransferStatus,
  Prisma,
} from '../generated/prisma/client';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { createPaginationResult } from '../common/helpers/pagination.helper';
import { PrinterService } from '../printer/printer.service';
import { transactionByIdReport } from '../reports/transacions/transaction-by-id.report';
import { convertAmountToWords } from '../helpers/numbers-to-words.helper';
import { ReceiptResolverService } from '../payments/receipt-resolver.service';

@Injectable()
export class InternalTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountsService: FinancialAccountsService,
    private readonly receiptResolverService: ReceiptResolverService,
    private readonly printerService: PrinterService,
  ) {}

  async create(createDto: CreateInternalTransferDto, user: any) {
    const {
      amount,
      sourceAccountId,
      destinationAccountId,
      description,
      reference,
      date,
    } = createDto;

    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException(
        'La cuenta de origen y destino no pueden ser la misma.',
      );
    }

    if (date) {
      const txDate = new Date(date);
      const now = new Date();
      if (txDate.getTime() > now.getTime() + 5 * 60 * 1000) {
        throw new BadRequestException('La fecha de la transferencia no puede ser en el futuro.');
      }
    }

    // Usar una transacción de Prisma para garantizar atomicidad
    return await this.prisma.$transaction(async (tx) => {
      // 1. Validar que las cuentas existan y estén activas
      const sourceAccount = await tx.financialAccount.findUnique({
        where: { id: sourceAccountId },
      });
      const destAccount = await tx.financialAccount.findUnique({
        where: { id: destinationAccountId },
      });

      if (!sourceAccount)
        throw new NotFoundException('Cuenta de origen no encontrada');
      if (!destAccount)
        throw new NotFoundException('Cuenta de destino no encontrada');
      if (!sourceAccount.isActive)
        throw new BadRequestException('La cuenta de origen está inactiva');
      if (!destAccount.isActive)
        throw new BadRequestException('La cuenta de destino está inactiva');

      // Validar saldo suficiente en la cuenta de origen
      const currentBalance = Number(sourceAccount.cachedBalance);
      if (currentBalance < amount) {
        throw new BadRequestException(
          `Saldo insuficiente en la cuenta de origen (Saldo actual: Bs. ${currentBalance.toFixed(2)}, Monto requerido: Bs. ${amount.toFixed(2)})`,
        );
      }

      const transactionDate = date ? new Date(date) : new Date();
      
      // Obtener el número de recibo de transferencia
      const receiptSeries = 'TRF';
      const receiptNumber = await this.receiptResolverService.nextReceiptNumber(receiptSeries, tx);

      // 2. Aplicar movimientos a los saldos primero (obteniendo lock determinista según orden)
      const isSourceFirst =
        sourceAccountId.localeCompare(destinationAccountId) < 0;

      let sourceMov, destMov;

      if (isSourceFirst) {
        sourceMov = await this.financialAccountsService.applyMovement(
          sourceAccountId,
          amount,
          TransactionType.EXPENSE,
          tx,
        );
        destMov = await this.financialAccountsService.applyMovement(
          destinationAccountId,
          amount,
          TransactionType.INCOME,
          tx,
        );
      } else {
        destMov = await this.financialAccountsService.applyMovement(
          destinationAccountId,
          amount,
          TransactionType.INCOME,
          tx,
        );
        sourceMov = await this.financialAccountsService.applyMovement(
          sourceAccountId,
          amount,
          TransactionType.EXPENSE,
          tx,
        );
      }

      // 3. Crear Transacción de Egreso (Salida)
      const sourceTransaction = await tx.transaction.create({
        data: {
          financialAccountId: sourceAccountId,
          amount,
          type: TransactionType.EXPENSE,
          description: description || `Transferencia a ${destAccount.name}`,
          reference,
          transactionDate,
          paymentMethod: 'TRANSFER',
          isInternalTransfer: true,
          receiptSeries: null,
          receiptNumber: null,
          balanceBefore: sourceMov.balanceBefore,
          balanceAfter: sourceMov.balanceAfter,
        },
      });

      // 4. Crear Transacción de Ingreso (Entrada)
      const destTransaction = await tx.transaction.create({
        data: {
          financialAccountId: destinationAccountId,
          amount,
          type: TransactionType.INCOME,
          description:
            description || `Transferencia desde ${sourceAccount.name}`,
          reference,
          transactionDate,
          paymentMethod: 'TRANSFER',
          isInternalTransfer: true,
          receiptSeries: null,
          receiptNumber: null,
          balanceBefore: destMov.balanceBefore,
          balanceAfter: destMov.balanceAfter,
        },
      });

      // 5. Crear la Entidad de Transferencia
      const transfer = await tx.internalTransfer.create({
        data: {
          amount,
          description,
          reference,
          date: transactionDate,
          sourceTransactionId: sourceTransaction.id,
          destinationTransactionId: destTransaction.id,
          status: TransferStatus.COMPLETED, // Podría ser PENDING en el futuro
          receiptSeries,
          receiptNumber,
        },
      });

      await this.financialAccountsService.recalculateAccountSnapshots(sourceAccountId, tx);
      await this.financialAccountsService.recalculateAccountSnapshots(destinationAccountId, tx);
      
      return transfer;
    }, { maxWait: 5000, timeout: 20000 });
  }

  async findAll(paginationDto: InternalTransfersPaginationDto) {
    const {
      page = 1,
      per_page = 10,
      sourceAccountId,
      destinationAccountId,
      createdById,
      startDate: rawStartDate,
      endDate: rawEndDate,
      start,
      end,
      orderBy = 'desc',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const startDate = rawStartDate || start;
    const endDate = rawEndDate || end;

    const effectiveStartDate = startDate
      ? (/^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(`${startDate}T00:00:00.000Z`) : new Date(startDate))
      : undefined;
    const effectiveEndDate = endDate
      ? (/^\d{4}-\d{2}-\d{2}$/.test(endDate) ? new Date(`${endDate}T23:59:59.999Z`) : new Date(endDate))
      : undefined;

    const where: Prisma.InternalTransferWhereInput = {
      ...(createdById && { createdById }),
      ...(sourceAccountId && {
        sourceTransaction: { financialAccountId: sourceAccountId },
      }),
      ...(destinationAccountId && {
        destinationTransaction: { financialAccountId: destinationAccountId },
      }),
      ...((effectiveStartDate || effectiveEndDate) && {
        date: {
          ...(effectiveStartDate && { gte: effectiveStartDate }),
          ...(effectiveEndDate && { lte: effectiveEndDate }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.internalTransfer.findMany({
        where,
        skip,
        take: per_page,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          sourceTransaction: {
            include: { financialAccount: true },
          },
          destinationTransaction: {
            include: { financialAccount: true },
          },
          createdBy: true,
        },
      }),
      this.prisma.internalTransfer.count({ where }),
    ]);

    return createPaginationResult(items, total, page, per_page);
  }

  async cancel(id: string) {
    let transfer = await this.prisma.internalTransfer.findUnique({
      where: { id },
      include: {
        sourceTransaction: true,
        destinationTransaction: true,
      },
    });

    if (!transfer) {
      // Fallback: check if id is a transaction ID (source or destination)
      transfer = await this.prisma.internalTransfer.findFirst({
        where: {
          OR: [
            { sourceTransactionId: id },
            { destinationTransactionId: id },
          ],
        },
        include: {
          sourceTransaction: true,
          destinationTransaction: true,
        },
      });
    }

    if (!transfer) {
      throw new NotFoundException(`Transferencia con ID ${id} no encontrada`);
    }

    if (transfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Esta transferencia ya fue anulada');
    }

    const transferId = transfer.id;

    return await this.prisma.$transaction(async (tx) => {
      // 0. Bloquear la transferencia para evitar cancelación concurrente
      const lockedTransfer = (await tx.$queryRaw`
        SELECT id, status
        FROM internal_transfers
        WHERE id = ${transferId}
        FOR UPDATE
      `) as { id: string; status: string }[];

      if (!lockedTransfer || lockedTransfer.length === 0) {
        throw new NotFoundException(`Transferencia con ID ${transferId} no encontrada`);
      }

      if (lockedTransfer[0].status === 'CANCELLED') {
        throw new BadRequestException('Esta transferencia ya fue anulada');
      }

      // Orden determinista para locks en cuentas
      const isSourceFirst =
        transfer.sourceTransaction.financialAccountId.localeCompare(
          transfer.destinationTransaction.financialAccountId,
        ) < 0;

      let sourceReversalMov, destReversalMov;

      if (isSourceFirst) {
        sourceReversalMov = await this.financialAccountsService.applyMovement(
          transfer.sourceTransaction.financialAccountId,
          transfer.amount,
          TransactionType.INCOME,
          tx,
        );
        destReversalMov = await this.financialAccountsService.applyMovement(
          transfer.destinationTransaction.financialAccountId,
          transfer.amount,
          TransactionType.EXPENSE,
          tx,
        );
      } else {
        destReversalMov = await this.financialAccountsService.applyMovement(
          transfer.destinationTransaction.financialAccountId,
          transfer.amount,
          TransactionType.EXPENSE,
          tx,
        );
        sourceReversalMov = await this.financialAccountsService.applyMovement(
          transfer.sourceTransaction.financialAccountId,
          transfer.amount,
          TransactionType.INCOME,
          tx,
        );
      }

      // 1. Marcar transacciones originales como CANCELLED
      await tx.transaction.update({
        where: { id: transfer.sourceTransactionId },
        data: { status: 'CANCELLED' },
      });
      await tx.transaction.update({
        where: { id: transfer.destinationTransactionId },
        data: { status: 'CANCELLED' },
      });

      // 3. Marcar transferencia como CANCELLED
      return await tx.internalTransfer.update({
        where: { id: transferId },
        data: { status: TransferStatus.CANCELLED },
      });
    });
  }

  async getReceiptPdf(id: string) {
    let transfer = await this.prisma.internalTransfer.findUnique({
      where: { id },
      include: {
        sourceTransaction: { include: { financialAccount: true } },
        destinationTransaction: { include: { financialAccount: true } },
      },
    });

    if (!transfer) {
      // Fallback: check if id is a transaction ID (source or destination)
      transfer = await this.prisma.internalTransfer.findFirst({
        where: {
          OR: [
            { sourceTransactionId: id },
            { destinationTransactionId: id },
          ],
        },
        include: {
          sourceTransaction: { include: { financialAccount: true } },
          destinationTransaction: { include: { financialAccount: true } },
        },
      });
    }

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    if (!transfer.receiptSeries || !transfer.receiptNumber) {
      return null;
    }

    const amountNumeric = Number(transfer.amount).toFixed(2);
    const amountLiteral = convertAmountToWords(Number(transfer.amount)).toUpperCase();

    let concept = transfer.description || 'TRANSFERENCIA INTERNA';
    if (transfer.status === 'CANCELLED') {
      concept = `[ANULADA] ${concept}`;
    }

    const data = {
      receiptSeries: transfer.receiptSeries,
      receiptNumber: transfer.receiptNumber.toString().padStart(6, '0'),
      date: transfer.date,
      payerName: transfer.sourceTransaction.financialAccount.name,
      payerDocument: '',
      beneficiaryName: undefined,
      amountLiteral,
      amountNumeric,
      concept,
      paymentMethod: 'TRANSFERENCIA',
      receiverName: transfer.destinationTransaction.financialAccount.name,
      receiverDocument: '',
      validationUrl: null,
      type: 'INTERNAL_TRANSFER' as const,
      isPartialPayment: false,
    };

    const docDefinition = transactionByIdReport({
      data,
      isSingle: false, // para que imprima 2 copias como recibo
    });

    return this.printerService.createPdf(docDefinition);
  }
}
