import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PrismaService } from 'src/prisma.service';
import { TransactionsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';
import { Prisma, StatusCharge } from 'src/generated/prisma/client';
import { PaymentStrategyFactory } from './strategies/payment-strategy.factory';
import { PersonsOptionsPaginationDto } from './dto/persons-options-pagination.dto';
import { TransactionsMapper } from './transactions.mapper';
import { FinancialAccountsService } from 'src/financial-accounts/financial-accounts.service';

export const transactionSelect = {
  id: true,
  receiptSeries: true,
  receiptNumber: true,
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
  financialAccount: {
    select: { name: true },
  },
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
          accountCharge: {
            select: {
              title: true,
              category: { select: { name: true } },
            },
          },
          membershipCharges: { select: { id: true } },
          studentCharges: { select: { id: true } },
          sessionBooking: { select: { id: true } },
        },
      },
    },
  },
} satisfies Prisma.TransactionSelect;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger('TransactionsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly financialAccountsService: FinancialAccountsService,
  ) {}

  async create(createTransactionDto: CreateTransactionDto, tx?: Prisma.TransactionClient) {
    const { amount, chargeTransactions, paymentMethod, financialAccountId, ...rest } =
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
    const execute = async (prisma: Prisma.TransactionClient) => {
        
        // --- NUEVA LÓGICA DE SECUENCIAS ---
        let determinedSeries = 'GEN'; // Serie por defecto

        if (chargeTransactions && chargeTransactions.length > 0) {
          // Buscamos el primer cargo para determinar su origen según reglas de negocio
          const firstCharge = await prisma.charge.findUnique({
            where: { id: chargeTransactions[0].chargeId },
            include: { membershipCharges: true, studentCharges: true },
          });
          
          if (firstCharge?.membershipCharges?.length > 0) {
            determinedSeries = 'EQ'; // Es un cargo de Equipo
          } else if (firstCharge?.studentCharges?.length > 0) {
            determinedSeries = 'CU'; // Es un cargo de Curso
          }
        }

        // Incrementamos la secuencia de forma atómica (si no existe, la crea empezando en 1)
        const sequence = await prisma.receiptSequence.upsert({
          where: { series: determinedSeries },
          update: { lastValue: { increment: 1 } },
          create: { 
            series: determinedSeries, 
            lastValue: 1, 
            description: `Secuencia autogenerada para ${determinedSeries}` 
          },
        });
        // -----------------------------------

        // 3.1. Crear la transacción base
        const transaction = await prisma.transaction.create({
          data: {
            ...rest,
            receiptSeries: sequence.series,
            receiptNumber: sequence.lastValue,
            amount,
            paymentMethod,
            status: paymentResult.transactionStatus,
            receiptUrls,
            financialAccountId,
          },
        });

        // 3.1.5. Aplicar el movimiento a la caja/banco
        if (financialAccountId) {
          await this.financialAccountsService.applyMovement(
            financialAccountId,
            amount,
            rest.type,
            prisma,
          );
        }

        // 3.2. Si hay cargos a los que aplicar
        if (chargeTransactions && chargeTransactions.length > 0) {
          for (const ct of chargeTransactions) {
            // Obtener el cargo
            const charge = await prisma.charge.findUnique({
              where: { id: ct.chargeId },
            });

            if (!charge) {
              throw new NotFoundException(
                `Cargo con ID ${ct.chargeId} no encontrado`,
              );
            }

            const currentPending = Number(
              charge.pendingAmount.toNumber().toFixed(2),
            );
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

            const newPendingAmount = Number(
              (currentPending - applied).toFixed(2),
            );
            const chargeAmount = Number(charge.amount.toNumber().toFixed(2));
            const discountAmount = Number(
              charge.discountAmount?.toNumber() || 0,
            );
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
    };

    const createdTransaction = tx ? await execute(tx) : await this.prisma.$transaction(execute);

    return {
      message: 'Transacción registrada con éxito',
      data: {
        transaction: TransactionsMapper.toDomain(createdTransaction as any),
        paymentData: paymentResult.providerResponse, // Datos del QR si aplica
      },
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
      type,
      paymentMethod,
      startDate,
      endDate,
      origin,
      categoryId,
      createdById,
    } = paginationDto;

    const skip = (page - 1) * per_page;

    const where: Prisma.TransactionWhereInput = {
      ...(payerPersonId && { payerPersonId }),
      ...(type && { type }),
      ...(paymentMethod && { paymentMethod }),
      ...(createdById && { createdById }),
      ...((startDate || endDate) && {
        transactionDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      }),
      ...(chargeId && {
        chargeTransactions: {
          some: { chargeId },
        },
      }),
      ...(categoryId && {
        chargeTransactions: {
          some: { charge: { accountCharge: { categoryId } } },
        },
      }),
      ...(origin === 'ACCOUNT_CHARGE' && {
        chargeTransactions: { some: { charge: { accountCharge: { isNot: null } } } },
      }),
      ...(origin === 'MEMBERSHIP' && {
        chargeTransactions: { some: { charge: { membershipCharges: { some: {} } } } },
      }),
      ...(origin === 'STUDENT' && {
        chargeTransactions: { some: { charge: { studentCharges: { some: {} } } } },
      }),
      ...(origin === 'BOOKING' && {
        chargeTransactions: { some: { charge: { sessionBooking: { isNot: null } } } },
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

    const mappedItems = items.map((item) =>
      TransactionsMapper.toDomain(item as any),
    );

    return createPaginationResult(mappedItems, totalItems, page, per_page);
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      select: transactionSelect,
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    return TransactionsMapper.toDomain(transaction as any);
  }

  async update(id: string, updateTransactionDto: UpdateTransactionDto) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    // Proteger campos inmutables del Ledger
    const { amount, type, financialAccountId, ...safeUpdateData } = updateTransactionDto as any;

    if (amount !== undefined || type !== undefined || financialAccountId !== undefined) {
      // Idealmente podríamos lanzar un error, pero para no romper el frontend si envía el DTO completo,
      // simplemente ignoramos estos campos financieros clave.
    }

    return await this.prisma.transaction.update({
      where: { id },
      data: safeUpdateData,
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
          const currentPending = Number(
            charge.pendingAmount.toNumber().toFixed(2),
          );
          const applied = Number(ct.amountApplied.toNumber().toFixed(2));
          const chargeAmount = Number(charge.amount.toNumber().toFixed(2));
          const discountAmount = Number(charge.discountAmount?.toNumber() || 0);

          const expectedTotal = chargeAmount - discountAmount;

          const newPendingAmount = Number(
            (currentPending + applied).toFixed(2),
          );
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

      // Revertir el saldo de la caja / banco asociada
      if (transaction.financialAccountId && transaction.status === 'COMPLETED') {
        await this.financialAccountsService.applyMovement(
          transaction.financialAccountId,
          -Number(transaction.amount),
          transaction.type,
          prisma,
        );
      }

      // Eliminar transacción
      const deletedTransaction = await prisma.transaction.delete({
        where: { id },
        select: transactionSelect,
      });

      return deletedTransaction;
    });
  }

  async getPersonsOptions(paginationDto: PersonsOptionsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      gender,
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const searchTerms = search ? search.trim().split(/\s+/) : [];

    const where: Prisma.PersonWhereInput = {
      ...(searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
                { secondLastName: { contains: term, mode: 'insensitive' } },
                { documentNumber: { contains: term, mode: 'insensitive' } },
              ],
            })),
          }
        : {}),
      ...(gender && { gender }),
    };

    const [persons, totalItems] = await Promise.all([
      this.prisma.person.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { name: orderBy },
        select: {
          id: true,
          name: true,
          lastName: true,
          secondLastName: true,
          documentNumber: true,
          gender: true,
          birthDate: true,
          imageUrl: true,
        },
      }),
      this.prisma.person.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / per_page);
    const currentPage = totalItems === 0 ? 0 : page;

    return {
      message: 'Miembros obtenidos exitosamente',
      data: persons.map((person) => ({
        ...person,
        fullName:
          `${person.name} ${person.lastName} ${person.secondLastName || ''}`.trim(),
      })),
      meta: {
        totalItems,
        itemsPerPage: per_page,
        totalPages,
        currentPage,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }
}
