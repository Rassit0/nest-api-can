import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCashClosureDto } from './dto/create-cash-closure.dto';
import { createPaginationResult } from '../common/helpers/pagination.helper';
import { Prisma } from '../generated/prisma/client';
import { PaginationDto } from 'src/common/dto/pagination';

/**
 * Servicio encargado de gestionar los arqueos y cierres de caja.
 *
 * NOTA ARQUITECTÓNICA:
 * - `CashClosure` es estrictamente un snapshot de auditoría.
 * - Su propósito es únicamente comparar el saldo físico con el saldo esperado (cachedBalance).
 * - NUNCA modifica el Ledger (Transactions / InternalTransfers).
 * - NUNCA modifica el `cachedBalance` de la caja. 
 * - Las diferencias detectadas son informativas; cualquier ajuste al Ledger debe 
 *   realizarse explícita y manualmente mediante un asiento contable.
 */
@Injectable()
export class CashClosuresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCashClosureDto: CreateCashClosureDto, userId: string) {
    const { financialAccountId, actualBalance, observations } =
      createCashClosureDto;

    // 1. Validar que la cuenta existe y es de tipo CASH
    const account = await this.prisma.financialAccount.findUnique({
      where: { id: financialAccountId },
    });

    if (!account) {
      throw new NotFoundException('Cuenta financiera no encontrada.');
    }

    if (account.type !== 'CASH') {
      throw new BadRequestException(
        'Los cierres de caja solo aplican a cuentas de efectivo (CASH).',
      );
    }

    // 2. Obtener el saldo esperado desde el Ledger inmutable
    const expectedBalance = account.cachedBalance;

    // 3. Calcular la diferencia
    const difference = new Prisma.Decimal(actualBalance).minus(expectedBalance);

    // 4. Validar observación si hay diferencia
    if (!difference.isZero() && (!observations || observations.trim() === '')) {
      throw new BadRequestException(
        'Debe proporcionar una observación justificando la diferencia encontrada en caja.',
      );
    }

    // 5. Crear el cierre de caja (Solo Auditoría, no toca el Ledger)
    const closure = await this.prisma.cashClosure.create({
      data: {
        financialAccountId,
        expectedBalance,
        actualBalance,
        difference,
        observations,
        createdById: userId,
      },
    });

    return closure;
  }

  async findAllByAccount(accountId: string, paginationDto: PaginationDto) {
    const { page, per_page: limit } = paginationDto;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.cashClosure.findMany({
        where: { financialAccountId: accountId },
        orderBy: { closedAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: {
            select: {
              email: true,
              person: {
                select: {
                  name: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.cashClosure.count({
        where: { financialAccountId: accountId },
      }),
    ]);

    return createPaginationResult(items, total, page, limit);
  }

  async findOne(id: string) {
    const closure = await this.prisma.cashClosure.findUnique({
      where: { id },
      include: {
        financialAccount: {
          select: { name: true, currency: true },
        },
        createdBy: {
          select: {
            email: true,
            person: {
              select: {
                name: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!closure) {
      throw new NotFoundException(`Cierre de caja con ID ${id} no encontrado.`);
    }

    return closure;
  }
}
