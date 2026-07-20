import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from 'src/prisma.service';
import { TransactionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory';

export const transactionSelect: Prisma.TransactionSelect = {
  id: true,
  amount: true,
  transactionDate: true,
  description: true,
  type: true,
  paymentMethod: true,
  reference: true,
  notes: true,
  status: true,
  receiptUrls: true,
  createdAt: true,
  updatedAt: true,
  payerPerson: {
    select: {
      id: true,
      name: true,
      lastName: true,
      documentNumber: true,
    },
  },
  chargeTransactions: {
    select: {
      id: true,
      amountApplied: true,
      charge: {
        select: {
          id: true,
          description: true,
          amount: true,
          pendingAmount: true,
          status: true,
        },
      },
    },
  },
};

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger('TransactionsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const { amount, chargeTransactions, paymentMethod, ...rest } =
      createTransactionDto;

    // Validación: La suma de lo que se aplica a los cargos no debe superar el amount
    if (chargeTransactions && chargeTransactions.length > 0) {
      const totalApplied = chargeTransactions.reduce(
        (acc, curr) => acc + curr.amountApplied,
        0,
      );
      if (Number(totalApplied.toFixed(2)) > Number(amount.toFixed(2))) {
        throw new BadRequestException(
          'La suma de los montos aplicados a los cargos no puede ser mayor al monto de la transacción.',
        );
      }
    }

    // 1. Obtener la estrategia de pago según el método
    const strategy = PaymentStrategyFactory.getStrategy(paymentMethod);

    // 2. Ejecutar la estrategia (generar QR, o validar efectivo/transferencia)
    const paymentResult = await strategy.processPayment(amount);

    // TODO: Si integration con S3 esta lista, mapear los archivos a URLs y agregarlos a receiptUrls
    const receiptUrls = [];

    // 3. Ejecutar todo en una transacción de BD
    const createdTransaction = await this.prisma.$transaction(async (prisma) => {
      // 3.1. Crear la transacción base
      const transaction = await prisma.transaction.create({
        data: {
          ...rest,
          amount,
          paymentMethod,
          status: paymentResult.transactionStatus,
          receiptUrls,
        },
      });

      // 3.2. Si hay cargos a los que aplicar
      if (chargeTransactions && chargeTransactions.length > 0) {
        for (const ct of chargeTransactions) {
          // Obtener el cargo
          const charge = await prisma.charge.findUnique({
            where: { id: ct.chargeId },
          });

          if (!charge) {
            throw new NotFoundException(`Cargo con ID ${ct.chargeId} no encontrado`);
          }

          const currentPending = Number(charge.pendingAmount.toNumber().toFixed(2));
          const applied = Number(ct.amountApplied.toFixed(2));

          if (currentPending < applied) {
            throw new BadRequestException(
              `El monto aplicado (${applied}) supera el saldo pendiente (${currentPending}) del cargo ${charge.id}`,
            );
          }

          if (applied === 0 && currentPending > 0) {
            throw new BadRequestException(
              `Solo se permiten recibos de monto 0 si el cargo tiene un saldo pendiente de 0.`,
            );
          }

          // Crear pivote
          await prisma.chargeTransaction.create({
            data: {
              chargeId: ct.chargeId,
              transactionId: transaction.id,
              amountApplied: applied,
            },
          });

          const newPendingAmount = Number((currentPending - applied).toFixed(2));
          const chargeAmount = Number(charge.amount.toNumber().toFixed(2));
          const discountAmount = Number(charge.discountAmount?.toNumber() || 0);
          const expectedTotal = chargeAmount - discountAmount;
          
          let newStatus = charge.status;

          if (newPendingAmount <= 0) {
            newStatus = StatusCharge.PAID;
          } else if (newPendingAmount < expectedTotal) {
            newStatus = StatusCharge.PARTIAL;
          } else {
            newStatus = StatusCharge.PENDING;
          }

          await prisma.charge.update({
            where: { id: charge.id },
            data: {
              pendingAmount: newPendingAmount,
              status: newStatus,
            },
          });
        }
      }

      return await prisma.transaction.findUnique({
        where: { id: transaction.id },
        select: transactionSelect,
      });
    });

    return {
      transaction: createdTransaction,
      paymentData: paymentResult.providerResponse, // Datos del QR si aplica
    };
  }

  async findAll(paginationDto: TransactionsPaginationDto) {
    const {
      page = 1,
      per_page = 10,
      search,
      sortField,
      orderBy,
      payerPersonId,
      chargeId,
    } = paginationDto;

    const skip = (page - 1) * per_page;

    const where: Prisma.TransactionWhereInput = {
      ...(payerPersonId && { payerPersonId }),
      ...(chargeId && {
        chargeTransactions: {
          some: { chargeId }
        }
      }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { reference: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: per_page,
        orderBy: {
          [sortField || 'createdAt']: orderBy,
        },
        select: transactionSelect,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return createPaginationResult(items, totalItems, page, per_page);
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      select: transactionSelect,
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return transaction;
  }

  async update(id: string, updateTransactionDto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return await this.prisma.transaction.update({
      where: { id },
      data: updateTransactionDto,
      select: transactionSelect,
    });
  }

  async remove(id: string) {
    // Busca la transacción con sus pagos aplicados a cargos
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        chargeTransactions: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Usar transacción de Prisma para asegurar consistencia
    return await this.prisma.$transaction(async (prisma) => {
      // Revertir cargos
      for (const ct of transaction.chargeTransactions) {
        const charge = await prisma.charge.findUnique({
          where: { id: ct.chargeId },
        });
        if (charge) {
          const currentPending = Number(charge.pendingAmount.toNumber().toFixed(2));
          const applied = Number(ct.amountApplied.toNumber().toFixed(2));
          const chargeAmount = Number(charge.amount.toNumber().toFixed(2));
          const discountAmount = Number(charge.discountAmount?.toNumber() || 0);
          
          const expectedTotal = chargeAmount - discountAmount;

          const newPendingAmount = Number((currentPending + applied).toFixed(2));
          let newStatus = charge.status;

          // Si el pending es igual o mayor al expectedTotal, vuelve a PENDING
          if (newPendingAmount >= expectedTotal) {
            newStatus = StatusCharge.PENDING;
          } else if (newPendingAmount > 0) {
            newStatus = StatusCharge.PARTIAL; // Si era PAID, ahora debe ser PARTIAL
          }

          await prisma.charge.update({
            where: { id: ct.chargeId },
            data: {
              pendingAmount: newPendingAmount,
              status: newStatus,
            },
          });
        }
      }

      // Eliminar carga pivote
      await prisma.chargeTransaction.deleteMany({
        where: { transactionId: id },
      });

      // Eliminar transacción
      const deletedTransaction = await prisma.transaction.delete({
        where: { id },
        select: transactionSelect,
      });

      return deletedTransaction;
    });
  }
}
