import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateMembershipDiscountDto } from './dto/create-membership-discount.dto';
import { UpdateMembershipDiscountDto } from './dto/update-membership-discount.dto';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipDiscountsPaginationDto } from './dto/pagination.dto';
import { MembershipChargesService } from 'src/membership-charges/membership-charges.service';

export const membershipDiscountSelect: Prisma.MembershipDiscountSelect = {
  id: true,
  playerMembershipId: true,
  recurringDiscountPercent: true,
  registrationDiscountPercent: true,
  startDate: true,
  endDate: true,
  type: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class MembershipDiscountService {
  private readonly logger = new Logger('MembershipDiscountService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipChargesService: MembershipChargesService,
  ) {}

  async create(createMembershipDiscountDto: CreateMembershipDiscountDto) {
    // Validamos que las fechas del descuento esten dentro del rango de la temporada
    // Valid ==============
    const playerMembership =
      await this.getPlayerMembershipWithOfferingWithSeason(
        createMembershipDiscountDto.playerMembershipId,
      );

    if (
      playerMembership.status === 'WITHDRAWN' ||
      playerMembership.status === 'FINISHED'
    ) {
      throw new BadRequestException(
        'No se pueden asignar descuentos a membresías finalizadas o retiradas',
      );
    }

    this.validateDiscountRangeDate(
      new Date(createMembershipDiscountDto.startDate),
      createMembershipDiscountDto.endDate
        ? new Date(createMembershipDiscountDto.endDate)
        : null,
      playerMembership.teamSeason.season.startDate,
      playerMembership.teamSeason.season.endDate,
    );
    // Fin Valid====================

    // Validamos que en las fechas no hay sobreposición de descuentos
    // Valid ==============
    await this.validateOverlappingDiscount(
      createMembershipDiscountDto.playerMembershipId,
      new Date(createMembershipDiscountDto.startDate),
      createMembershipDiscountDto.endDate
        ? new Date(createMembershipDiscountDto.endDate)
        : null,
    );
    // Fin Valid ===============

    const newCreateMembershipDiscount =
      await this.prisma.membershipDiscount.create({
        data: createMembershipDiscountDto,
        select: membershipDiscountSelect,
      });

    // Recalcular cargos pendientes tras asignar descuento
    this.membershipChargesService.recalculatePendingFutureCharges(createMembershipDiscountDto.playerMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras asignar descuento a membresía ${createMembershipDiscountDto.playerMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento de membresia asignada exitosamente',
      data: newCreateMembershipDiscount,
    };
  }

  async findAll(paginationDto: PlayerMembershipDiscountsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      playerMembershipId,
      type,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.MembershipDiscountWhereInput = {};

    if (playerMembershipId) {
      where.playerMembershipId = playerMembershipId;
    }

    if (type) {
      where.type = type;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [membershipDiscountsToTeams, totalItems] = await Promise.all([
      this.prisma.membershipDiscount.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: membershipDiscountSelect,
      }),
      this.prisma.membershipDiscount.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = page;

    return {
      message:
        'Descuentos de membresías de jugador a equipo obtenidos exitosamente',
      data: membershipDiscountsToTeams, // Será [] si la página no existe o no hay registros
      meta: {
        totalItems, // Ej: 25
        itemsPerPage: per_page, // Ej: 10
        totalPages, // Ej: 3
        currentPage, // Ej: 10 (si el usuario pidió el page 90)
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async findOne(id: string) {
    const membershipDiscount = await this.prisma.membershipDiscount.findUnique({
      where: { id },
      select: membershipDiscountSelect,
    });
    if (!membershipDiscount) {
      throw new NotFoundException(
        'La membresía de jugador a equipo no fue encontrada',
      );
    }
    return {
      data: membershipDiscount,
      message:
        'Descuento de membresía de jugador a equipo obtenido exitosamente',
    };
  }

  async update(
    id: string,
    updateMembershipDiscountDto: UpdateMembershipDiscountDto,
  ) {
    const membershipDiscount = await this.getMembershipDiscount(id);

    const startDate = updateMembershipDiscountDto.startDate
      ? new Date(updateMembershipDiscountDto.startDate)
      : membershipDiscount.startDate;

    const endDate =
      updateMembershipDiscountDto.endDate !== undefined
        ? updateMembershipDiscountDto.endDate
          ? new Date(updateMembershipDiscountDto.endDate)
          : null
        : membershipDiscount.endDate;

    const playerMembership =
      await this.getPlayerMembershipWithOfferingWithSeason(
        membershipDiscount.playerMembershipId,
      );

    if (
      playerMembership.status === 'WITHDRAWN' ||
      playerMembership.status === 'FINISHED'
    ) {
      throw new BadRequestException(
        'No se pueden modificar descuentos de membresías finalizadas o retiradas',
      );
    }

    this.validateDiscountRangeDate(
      startDate,
      endDate,
      playerMembership.teamSeason.season.startDate,
      playerMembership.teamSeason.season.endDate,
    );

    await this.validateOverlappingDiscount(
      membershipDiscount.playerMembershipId,
      startDate,
      endDate,
      id,
    );

    const updatedMembershipDiscount =
      await this.prisma.membershipDiscount.update({
        where: { id },
        data: updateMembershipDiscountDto,
        select: membershipDiscountSelect,
      });

    // Recalcular cargos pendientes
    this.membershipChargesService.recalculatePendingFutureCharges(membershipDiscount.playerMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras actualizar descuento en membresía ${membershipDiscount.playerMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento de membresía actualizado exitosamente',
      data: updatedMembershipDiscount,
    };
  }

  async remove(id: string) {
    const discount = await this.getMembershipDiscount(id);

    // todo: agregar validacion si no tiene relaciones recién puede eliminar

    await this.prisma.membershipDiscount.delete({
      where: { id },
    });

    // Recalcular cargos pendientes
    this.membershipChargesService.recalculatePendingFutureCharges(discount.playerMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras eliminar descuento en membresía ${discount.playerMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento eliminado exitosamente',
    };
  }

  async finish(id: string) {
    const discount = await this.getMembershipDiscount(id);

    const now = new Date();

    if (discount.endDate && discount.endDate <= now) {
      throw new BadRequestException('El descuento ya se encuentra finalizado');
    }

    if (now <= discount.startDate) {
      throw new BadRequestException(
        'No se puede finalizar un descuento antes de que inicie',
      );
    }

    const finishedMembershipDiscount =
      await this.prisma.membershipDiscount.update({
        where: { id },
        data: { endDate: now },
        select: membershipDiscountSelect,
      });

    // Recalcular cargos pendientes
    this.membershipChargesService.recalculatePendingFutureCharges(discount.playerMembershipId).catch(e => {
      this.logger.error(`Error al recalcular cargos tras finalizar descuento en membresía ${discount.playerMembershipId}`, e.stack);
    });

    return {
      message: 'Descuento finalizado exitosamente',
      data: finishedMembershipDiscount,
    };
  }

  private async getPlayerMembershipWithOfferingWithSeason(id: string) {
    const playerMembership = await this.prisma.playerMembership.findUnique({
      where: { id },
      include: {
        teamSeason: {
          select: {
            season: {
              select: {
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    });

    if (!playerMembership) {
      throw new NotFoundException('La membresía no fué encontrada');
    }

    return playerMembership;
  }

  private async getMembershipDiscount(id: string) {
    const membershipDiscount = await this.prisma.membershipDiscount.findUnique({
      where: { id },
    });

    if (!membershipDiscount) {
      throw new NotFoundException(
        'El descuento de membresia de jugador a equipo no fue encontrado',
      );
    }
    return membershipDiscount;
  }

  private validateDiscountRangeDate(
    startDate: Date,
    endDate: Date | null,
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    if (startDate < seasonStartDate || startDate > seasonEndDate) {
      throw new BadRequestException(
        `La fecha de inicio del descuento debe estar dentro de la temporada (${seasonStartDate.toISOString()} - ${seasonEndDate.toISOString()})`,
      );
    }

    if (endDate && (endDate < seasonStartDate || endDate > seasonEndDate)) {
      throw new BadRequestException(
        `La fecha de finalización del descuento debe estar dentro de la temporada (${seasonStartDate.toISOString()} - ${seasonEndDate.toISOString()})`,
      );
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio',
      );
    }
  }

  private async validateOverlappingDiscount(
    playerMembershipId: string,
    startDate: Date,
    endDate: Date | null,
    id?: string,
  ) {
    const effectiveEndDate = endDate ?? new Date('9999-12-31');

    const overlappingDiscount = await this.prisma.membershipDiscount.findFirst({
      where: {
        ...(id && {
          NOT: {
            id,
          },
        }),
        playerMembershipId,
        startDate: {
          lte: effectiveEndDate,
        },
        OR: [
          {
            endDate: null,
          },
          {
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
    });

    if (overlappingDiscount) {
      throw new BadRequestException(
        'Ya existe un descuento activo en el rango de fechas especificado',
      );
    }
  }
}
