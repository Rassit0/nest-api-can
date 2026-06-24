import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatePlayerMembershipDto } from './dto/create-player-membership.dto';
import { UpdatePlayerMembershipDto } from './dto/update-player-membership.dto';
import { PrismaService } from 'src/prisma.service';
import { PlayerMembershipStatus, Prisma } from 'src/generated/prisma/client';
import { PlayerMembershipsPaginationDto } from './dto/pagination.dto';

export const playerMembershipSelect: Prisma.PlayerMembershipSelect = {
  id: true,
  playerId: true,
  teamSeasonId: true,
  paymentPlanId: true,
  startedAt: true,
  endedAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

type PlayerWithPerson = Prisma.PlayerGetPayload<{
  include: {
    person: true;
  };
}>;

type TeamMembershipOfferingWithCategory = Prisma.TeamSeasonGetPayload<{
  include: {
    category: {
      select: {
        minAge: true;
        maxAge: true;
      };
    };
    season: {
      select: {
        startDate: true;
        endDate: true;
      };
    };
  };
}>;

@Injectable()
export class PlayerMembershipsService {
  private readonly logger = new Logger('PlayerMembershipsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreatePlayerMembershipDto) {
    await this.validatePaymentPlan(
      createDto.paymentPlanId,
      createDto.teamSeasonId,
    );

    const [player, offering] = await Promise.all([
      this.getPlayer(createDto.playerId),
      this.getTeamMembershipOffering(createDto.teamSeasonId),
    ]);

    this.validateMembershipStartDate(
      new Date(createDto.startedAt),
      offering.season.startDate,
      offering.season.endDate,
    );

    await this.validateOfferingCapacity(offering.id, offering.maxMembers);

    await this.validateDuplicateMembership(
      createDto.playerId,
      createDto.teamSeasonId,
    );

    this.validatePlayerEligibility(player, offering);

    const membership = await this.prisma.playerMembership.create({
      data: createDto,
      select: playerMembershipSelect,
    });

    return {
      message: 'Oferta de membresía de equipo agregada exitosamente',
      data: membership,
    };
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  private validatePlayerAge(birthDate: Date, minAge?: number, maxAge?: number) {
    const playerAge = this.calculateAge(birthDate);

    if (maxAge && playerAge > maxAge) {
      throw new BadRequestException(
        'El jugador es demasiado mayor para esta categoría',
      );
    }

    if (minAge && playerAge < minAge) {
      throw new BadRequestException(
        'El jugador es demasiado joven para esta categoría',
      );
    }
  }

  async findAll(paginationDto: PlayerMembershipsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      playerId,
      teamSeasonId,
      paymentPlanId,
      status,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.PlayerMembershipWhereInput = {};

    if (playerId) {
      where.playerId = playerId;
    }

    if (teamSeasonId) {
      where.teamSeasonId = teamSeasonId;
    }

    if (paymentPlanId) {
      where.paymentPlanId = paymentPlanId;
    }

    if (status) {
      where.status = status;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [playerMemberships, totalItems] = await Promise.all([
      this.prisma.playerMembership.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: playerMembershipSelect,
      }),
      this.prisma.playerMembership.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = page;

    return {
      message: 'Membresías de jugador a equipo obtenidas exitosamente',
      data: playerMemberships, // Será [] si la página no existe o no hay registros
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
    const playerMembership = await this.prisma.playerMembership.findUnique({
      where: { id },
      select: playerMembershipSelect,
    });
    if (!playerMembership) {
      throw new NotFoundException(
        'La membresía de jugador a equipo no fue encontrada',
      );
    }
    return {
      data: playerMembership,
      message: 'Membresía de jugador a equipo obtenida exitosamente',
    };
  }

  async update(id: string, updateDto: UpdatePlayerMembershipDto) {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException(
        'La membresía de jugador a equipo no fue encontrada',
      );
    }

    const playerId = updateDto.playerId ?? membership.playerId;

    const offeringId = updateDto.teamSeasonId ?? membership.teamSeasonId;

    if (updateDto.paymentPlanId) {
      await this.validatePaymentPlan(updateDto.paymentPlanId, offeringId);
    }

    const [player, offering] = await Promise.all([
      this.getPlayer(playerId),
      this.getTeamMembershipOffering(offeringId),
    ]);

    this.validateMembershipStartDate(
      updateDto.startedAt
        ? new Date(updateDto.startedAt)
        : membership.startedAt,
      offering.season.startDate,
      offering.season.endDate,
    );

    this.validatePlayerEligibility(player, offering);

    const isChangingOffering =
      updateDto.teamSeasonId &&
      updateDto.teamSeasonId !== membership.teamSeasonId;

    if (isChangingOffering) {
      await this.validateOfferingCapacity(offering.id, offering.maxMembers);

      await this.validateDuplicateMembership(playerId, offeringId, id);
    }

    const updatedMembership = await this.prisma.playerMembership.update({
      where: { id },
      data: updateDto,
      select: playerMembershipSelect,
    });

    return {
      message: 'Membresía de jugador a equipo actualizada exitosamente',
      data: updatedMembership,
    };
  }

  async finish(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === PlayerMembershipStatus.FINISHED) {
      throw new BadRequestException('La membresía ya se encuentra finalizada');
    }

    if (membership.status === PlayerMembershipStatus.SUSPENDED) {
      throw new BadRequestException(
        'La membresía se encuentra suspendida y no puede ser finalizada',
      );
    }

    if (membership.status === PlayerMembershipStatus.WITHDRAWN) {
      throw new BadRequestException(
        'La membresía se encuentra retirada y no puede ser suspendida',
      );
    }

    const finishedMembership = await this.prisma.playerMembership.update({
      where: { id },
      data: {
        status: PlayerMembershipStatus.FINISHED,
        endedAt: new Date(),
        notes: reason,
      },
      select: playerMembershipSelect,
    });

    return {
      message: 'Membresía finalizada exitosamente',
      data: finishedMembership,
    };
  }

  async suspend(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === PlayerMembershipStatus.FINISHED) {
      throw new BadRequestException(
        'La membresía se encuentra finalizada y no puede ser suspendida',
      );
    }

    if (membership.status === PlayerMembershipStatus.SUSPENDED) {
      throw new BadRequestException('La membresía ya se encuentra suspendida');
    }

    if (membership.status === PlayerMembershipStatus.WITHDRAWN) {
      throw new BadRequestException(
        'La membresía se encuentra retirada y no puede ser suspendida',
      );
    }

    const finishedMembership = await this.prisma.playerMembership.update({
      where: { id },
      data: {
        status: PlayerMembershipStatus.SUSPENDED,
        notes: reason,
      },
      select: playerMembershipSelect,
    });

    return {
      message: 'Membresía suspendida exitosamente',
      data: finishedMembership,
    };
  }

  async withdraw(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status === PlayerMembershipStatus.FINISHED) {
      throw new BadRequestException(
        'La membresía se encuentra finalizada y no puede ser retirada',
      );
    }

    if (membership.status === PlayerMembershipStatus.SUSPENDED) {
      throw new BadRequestException(
        'La membresía se encuentra suspendida y no puede ser finalizada',
      );
    }

    if (membership.status === PlayerMembershipStatus.WITHDRAWN) {
      throw new BadRequestException('La membresía ya se encuentra retirada');
    }

    const finishedMembership = await this.prisma.playerMembership.update({
      where: { id },
      data: {
        status: PlayerMembershipStatus.WITHDRAWN,
        endedAt: new Date(),
        notes: reason,
      },
      select: playerMembershipSelect,
    });

    return {
      message: 'Membresía retirada exitosamente',
      data: finishedMembership,
    };
  }

  async reactivate(id: string, reason?: string) {
    const membership = await this.getMembership(id);

    if (membership.status !== PlayerMembershipStatus.SUSPENDED) {
      throw new BadRequestException(
        'Solo una membresía suspendida puede reactivarse',
      );
    }

    const updatedMembership = await this.prisma.playerMembership.update({
      where: { id },
      data: {
        status: PlayerMembershipStatus.ACTIVE,
        notes: reason,
      },
      select: playerMembershipSelect,
    });

    return {
      message: 'Membresía reactivada exitosamente',
      data: updatedMembership,
    };
  }

  private async getMembership(id: string) {
    const membership = await this.prisma.playerMembership.findUnique({
      where: { id },
    });

    if (!membership) {
      throw new NotFoundException(
        'La membresía de jugador a equipo no fue encontrada',
      );
    }
    return membership;
  }

  private async validatePaymentPlan(
    paymentPlanId: string,
    teamSeasonId: string,
  ) {
    const paymentPlan = await this.prisma.paymentPlan.findUnique({
      where: { id: paymentPlanId },
    });

    if (!paymentPlan) {
      throw new BadRequestException('El plan de pago no fue encontrado');
    }

    if (paymentPlan.teamSeasonId !== teamSeasonId) {
      throw new BadRequestException(
        'El plan de pago no pertenece a la oferta seleccionada',
      );
    }
  }

  private async getPlayer(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        person: true,
      },
    });

    if (!player) {
      throw new NotFoundException('El jugador no fue encontrado');
    }

    return player;
  }

  private async getTeamMembershipOffering(teamSeasonId: string) {
    const offering = await this.prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: {
        category: {
          select: {
            minAge: true,
            maxAge: true,
          },
        },
        season: {
          select: {
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!offering) {
      throw new NotFoundException(
        'La oferta de membresía de equipo no fue encontrada',
      );
    }

    return offering;
  }

  private async validateOfferingCapacity(
    offeringId: string,
    maxMembers: number,
  ) {
    const activeMembers = await this.prisma.playerMembership.count({
      where: {
        teamSeasonId: offeringId,
        status: {
          in: [PlayerMembershipStatus.ACTIVE, PlayerMembershipStatus.SUSPENDED],
        },
      },
    });

    if (activeMembers >= maxMembers) {
      throw new BadRequestException(
        'La oferta ya alcanzó el número máximo de miembros',
      );
    }
  }

  private async validateDuplicateMembership(
    playerId: string,
    teamSeasonId: string,
    currentMembershipId?: string,
  ) {
    const existingMembership = await this.prisma.playerMembership.findFirst({
      where: {
        playerId,
        teamSeasonId,
        ...(currentMembershipId && {
          NOT: {
            id: currentMembershipId,
          },
        }),
      },
    });

    if (existingMembership) {
      throw new BadRequestException(
        'El jugador ya se encuentra registrado en esta oferta',
      );
    }
  }

  private validatePlayerEligibility(
    player: PlayerWithPerson,
    offering: TeamMembershipOfferingWithCategory,
  ) {
    if (!player.isActive) {
      throw new BadRequestException('El jugador se encuentra inactivo');
    }

    if (!player.person.birthDate) {
      throw new BadRequestException(
        'La fecha de nacimiento del jugador no fue encontrada',
      );
    }

    this.validatePlayerAge(
      player.person.birthDate,
      offering.category.minAge,
      offering.category.maxAge,
    );

    if (
      offering.gender !== 'MIXED' &&
      offering.gender !== player.person.gender
    ) {
      throw new BadRequestException(
        'El género del jugador no es compatible con el equipo',
      );
    }
  }

  private validateMembershipStartDate(
    startedAt: Date,
    seasonStartDate: Date,
    seasonEndDate: Date,
  ) {
    if (startedAt < seasonStartDate || startedAt > seasonEndDate) {
      throw new BadRequestException(
        `La fecha de inicio de la membresía debe estar dentro del rango de fechas de la temporada (${seasonStartDate.toISOString()} - ${seasonEndDate.toISOString()})`,
      );
    }
  }
}
