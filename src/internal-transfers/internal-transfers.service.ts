import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateInternalTransferDto } from './dto/create-internal-transfer.dto';
import { InternalTransfersPaginationDto } from './dto/pagination.dto';
import { TransactionType, TransferStatus, Prisma } from '../generated/prisma/client';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { createPaginationResult } from '../common/helpers/pagination.helper';


@Injectable()
export class InternalTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountsService: FinancialAccountsService,
  ) {}

  async create(createDto: CreateInternalTransferDto, user: any) {
    const { amount, sourceAccountId, destinationAccountId, description, reference, date } = createDto;

    if (sourceAccountId === destinationAccountId) {
      throw new BadRequestException('La cuenta de origen y destino no pueden ser la misma.');
    }

    // Usar una transacción de Prisma para garantizar atomicidad
    return await this.prisma.$transaction(async (tx) => {
      // 1. Validar que las cuentas existan y estén activas
      const sourceAccount = await tx.financialAccount.findUnique({ where: { id: sourceAccountId } });
      const destAccount = await tx.financialAccount.findUnique({ where: { id: destinationAccountId } });

      if (!sourceAccount) throw new NotFoundException('Cuenta de origen no encontrada');
      if (!destAccount) throw new NotFoundException('Cuenta de destino no encontrada');
      if (!sourceAccount.isActive) throw new BadRequestException('La cuenta de origen está inactiva');
      if (!destAccount.isActive) throw new BadRequestException('La cuenta de destino está inactiva');

      // Validar saldo suficiente en la cuenta de origen
      const currentBalance = Number(sourceAccount.cachedBalance);
      if (currentBalance < amount) {
        throw new BadRequestException(`Saldo insuficiente en la cuenta de origen (Saldo actual: Bs. ${currentBalance.toFixed(2)}, Monto requerido: Bs. ${amount.toFixed(2)})`);
      }

      const transactionDate = date ? new Date(date) : new Date();

      // 2. Aplicar movimientos a los saldos primero (obteniendo lock determinista según orden)
      const isSourceFirst = sourceAccountId.localeCompare(destinationAccountId) < 0;
      
      let sourceMov, destMov;
      
      if (isSourceFirst) {
        sourceMov = await this.financialAccountsService.applyMovement(sourceAccountId, amount, TransactionType.EXPENSE, tx);
        destMov = await this.financialAccountsService.applyMovement(destinationAccountId, amount, TransactionType.INCOME, tx);
      } else {
        destMov = await this.financialAccountsService.applyMovement(destinationAccountId, amount, TransactionType.INCOME, tx);
        sourceMov = await this.financialAccountsService.applyMovement(sourceAccountId, amount, TransactionType.EXPENSE, tx);
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
          receiptSeries: 'TR',
          receiptNumber: Math.floor(Math.random() * 1000000), // Podríamos usar una secuencia real
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
          description: description || `Transferencia desde ${sourceAccount.name}`,
          reference,
          transactionDate,
          paymentMethod: 'TRANSFER',
          isInternalTransfer: true,
          receiptSeries: 'TR',
          receiptNumber: Math.floor(Math.random() * 1000000),
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
        },
      });

      return transfer;
    });
  }

  async findAll(paginationDto: InternalTransfersPaginationDto) {
    const { page = 1, per_page = 10, sourceAccountId, destinationAccountId, createdById, startDate, endDate, orderBy = 'desc' } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.InternalTransferWhereInput = {
      ...(createdById && { createdById }),
      ...(sourceAccountId && { sourceTransaction: { financialAccountId: sourceAccountId } }),
      ...(destinationAccountId && { destinationTransaction: { financialAccountId: destinationAccountId } }),
      ...((startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.internalTransfer.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { date: orderBy as any },
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
    const transfer = await this.prisma.internalTransfer.findUnique({
      where: { id },
      include: {
        sourceTransaction: true,
        destinationTransaction: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transferencia con ID ${id} no encontrada`);
    }

    if (transfer.status === TransferStatus.CANCELLED) {
      throw new BadRequestException('Esta transferencia ya fue anulada');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 0. Bloquear la transferencia para evitar cancelación concurrente
      const lockedTransfer = (await tx.$queryRaw`
        SELECT id, status
        FROM internal_transfers
        WHERE id = ${id}
        FOR UPDATE
      `) as { id: string; status: string }[];

      if (!lockedTransfer || lockedTransfer.length === 0) {
        throw new NotFoundException(`Transferencia con ID ${id} no encontrada`);
      }

      if (lockedTransfer[0].status === 'CANCELLED') {
        throw new BadRequestException('Esta transferencia ya fue anulada');
      }

      // Orden determinista para locks en cuentas
      const isSourceFirst = transfer.sourceTransaction.financialAccountId.localeCompare(transfer.destinationTransaction.financialAccountId) < 0;
      
      let sourceReversalMov, destReversalMov;
      
      if (isSourceFirst) {
        sourceReversalMov = await this.financialAccountsService.applyMovement(transfer.sourceTransaction.financialAccountId, transfer.amount, TransactionType.INCOME, tx);
        destReversalMov = await this.financialAccountsService.applyMovement(transfer.destinationTransaction.financialAccountId, transfer.amount, TransactionType.EXPENSE, tx);
      } else {
        destReversalMov = await this.financialAccountsService.applyMovement(transfer.destinationTransaction.financialAccountId, transfer.amount, TransactionType.EXPENSE, tx);
        sourceReversalMov = await this.financialAccountsService.applyMovement(transfer.sourceTransaction.financialAccountId, transfer.amount, TransactionType.INCOME, tx);
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

      // 2. Crear transacciones de reversa (con saldos historicos)
      await tx.transaction.create({
        data: {
          amount: transfer.amount,
          type: TransactionType.INCOME,
          status: 'COMPLETED',
          transactionDate: new Date(),
          paymentMethod: transfer.sourceTransaction.paymentMethod,
          financialAccountId: transfer.sourceTransaction.financialAccountId,
          description: `Reversión de transferencia: ${transfer.id}`,
          isInternalTransfer: true,
          reversesId: transfer.sourceTransaction.id,
          balanceBefore: sourceReversalMov.balanceBefore,
          balanceAfter: sourceReversalMov.balanceAfter,
        } as Prisma.TransactionUncheckedCreateInput,
      });

      await tx.transaction.create({
        data: {
          amount: transfer.amount,
          type: TransactionType.EXPENSE,
          status: 'COMPLETED',
          transactionDate: new Date(),
          paymentMethod: transfer.destinationTransaction.paymentMethod,
          financialAccountId: transfer.destinationTransaction.financialAccountId,
          description: `Reversión de transferencia: ${transfer.id}`,
          isInternalTransfer: true,
          reversesId: transfer.destinationTransaction.id,
          balanceBefore: destReversalMov.balanceBefore,
          balanceAfter: destReversalMov.balanceAfter,
        } as Prisma.TransactionUncheckedCreateInput,
      });

      // 3. Marcar transferencia como CANCELLED
      return await tx.internalTransfer.update({
        where: { id },
        data: { status: TransferStatus.CANCELLED },
      });
    });
  }
}
