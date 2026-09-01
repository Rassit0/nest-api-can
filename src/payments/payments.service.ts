import { Injectable, Logger, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { FinancialAccountsService } from 'src/financial-accounts/financial-accounts.service';
import { TransactionsPaginationDto } from 'src/transactions/dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { syncCycleEnrollmentStatus } from 'src/common/helpers/sync-cycle-enrollment.helper';
import { lockChargeForUpdate } from 'src/common/utils/charge-lock.util';

export const paymentSelect = {
  id: true,
  chargeId: true,
  receiptSeries: true,
  receiptNumber: true,
  amount: true,
  status: true,
  paymentDate: true,
  createdAt: true,
  updatedAt: true,
  transactions: {
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      description: true,
      type: true,
      paymentMethod: true,
      reference: true,
      notes: true,
      status: true,
      createdAt: true,
      financialAccount: {
        select: { name: true },
      },
      payerPerson: {
        select: { name: true, lastName: true },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');

  constructor(
    private prisma: PrismaService,
    private financialAccountsService: FinancialAccountsService,
  ) {}

  async findAll(paginationDto: TransactionsPaginationDto) {
    const { page = 1, per_page = 10, chargeId, sortField, orderBy } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.PaymentWhereInput = {
      ...(chargeId && { chargeId }),
    };

    const [items, totalItems] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: per_page,
        orderBy: {
          [sortField || 'createdAt']: orderBy || 'desc',
        },
        select: paymentSelect,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const mappedItems = items.map((item) => ({
      ...item,
      amount: Number(item.amount),
      transactions: item.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        financialAccountName: (t as any).financialAccount?.name || null,
      })),
    }));

    return createPaginationResult(mappedItems, totalItems, page, per_page);
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: paymentSelect,
    });

    if (!payment) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    return {
      ...payment,
      amount: Number(payment.amount),
      transactions: payment.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        financialAccountName: (t as any).financialAccount?.name || null,
      })),
    };
  }

  async removePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: true,
        charge: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    if (payment.status === 'CANCELLED') {
      throw new BadRequestException('El pago ya se encuentra anulado');
    }

    
    return await this.prisma.$transaction(async (prisma) => {
      // 1. Fail-Safe matemAtico
      const paymentAmount = Number(payment.amount.toNumber().toFixed(2));
      const transactionsSum = payment.transactions.reduce(
        (sum, t) => sum + Number(t.amount.toNumber().toFixed(2)),
        0,
      );

      if (paymentAmount !== Number(transactionsSum.toFixed(2))) {
        this.logger.error(`Fail-Safe disparado en removePayment para ID ${id}. Monto del pago: ${paymentAmount}, Suma transacciones: ${transactionsSum}`);
        throw new InternalServerErrorException(
          'Inconsistencia financiera detectada. El monto del pago no coincide con la suma de sus transacciones. Operación abortada.',
        );
      }

      // 2. Revertir saldo del Charge (Solo 1 vez, usando el payment.amount total)
      // El Charge debe bloquearse antes de leer/calcular pendingAmount.
      // Payments, reversos y Late Fees realizan Read-Modify-Write sobre
      // este mismo saldo. El lock evita Lost Updates bajo concurrencia.
      // Usar exclusivamente el estado obtenido después del FOR UPDATE.
      const lockedCharge = await lockChargeForUpdate(prisma, payment.chargeId);

      const charge = payment.charge;
      charge.amount = new Prisma.Decimal(lockedCharge.amount.toString());
      charge.pendingAmount = new Prisma.Decimal(lockedCharge.pendingAmount.toString());
      charge.status = lockedCharge.status;
      charge.adjustmentAmount = lockedCharge.adjustmentAmount ? new Prisma.Decimal(lockedCharge.adjustmentAmount.toString()) : null;

      const currentPending = Number(charge.pendingAmount.toNumber().toFixed(2));
      const chargeAmount = Number(charge.amount.toNumber().toFixed(2));
      const adjustmentAmount = Number(charge.adjustmentAmount?.toNumber() || 0);
  
      const expectedTotal = chargeAmount + adjustmentAmount;
      const newPendingAmount = Number((currentPending + paymentAmount).toFixed(2));
      let newStatus = charge.status;

      if (newPendingAmount >= expectedTotal) {
        newStatus = StatusCharge.PENDING;
      } else if (newPendingAmount > 0) {
        newStatus = StatusCharge.PARTIAL;
      }

      await prisma.charge.update({
        where: { id: charge.id },
        data: {
          pendingAmount: newPendingAmount,
          status: newStatus,
        },
      });

      await syncCycleEnrollmentStatus(prisma, charge.id, newStatus);

      // 3. Revertir saldos en cuentas financieras (por Transaction) y anular Transactions
      for (const t of payment.transactions) {
        if (t.financialAccountId && t.status === 'COMPLETED') {
          // Si fue ingreso, al mandar negativo se decrementa el balance en applyMovement
          await this.financialAccountsService.applyMovement(
            t.financialAccountId,
            -Number(t.amount),
            t.type,
            prisma,
          );
        }

        await prisma.transaction.update({
          where: { id: t.id },
          data: { status: 'CANCELLED' },
        });
      }

      // 4. Anular Payment
      const deletedPayment = await prisma.payment.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      return {
        message: 'Pago y transacciones anulados correctamente',
        data: deletedPayment,
      };
    });
  }
}
