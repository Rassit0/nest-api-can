import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateTeamSeasonCategoryDto } from './dto/create-team-season-category.dto';
import { UpdateTeamSeasonCategoryDto } from './dto/update-team-season-category.dto';
import { FinishEarlyTeamSeasonCategoryDto } from './dto/finish-early-team-season-category.dto';
import { Prisma, PlayerMembershipStatus, StatusCharge, TeamSeasonCategoryStatus } from 'src/generated/prisma/client';

export const teamSeasonCategorySelect: Prisma.TeamSeasonCategorySelect = {
  id: true,
  teamSeasonId: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  gender: true,
  minBirthYear: true,
  maxBirthYear: true,
  minMembers: true,
  maxMembers: true,
  validateAge: true,
  isActive: true,
  status: true,
  endedAt: true,
  _count: {
    select: {
      player_membership: {
        where: {
          OR: [
            {
              status: PlayerMembershipStatus.SUSPENDED,
            },
            {
              status: PlayerMembershipStatus.ACTIVE,
            },
            {
              status: PlayerMembershipStatus.PENDING_ACTIVE,
            },
          ],
        },
      },
    },
  },
};

@Injectable()
export class TeamSeasonCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(teamSeasonId: string, createDto: CreateTeamSeasonCategoryDto) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
    });

    if (!teamSeason) {
      throw new NotFoundException('La temporada del equipo no fue encontrada');
    }

    const newCategory = await this.prisma.teamSeasonCategory.create({
      data: {
        teamSeasonId,
        ...createDto,
      },
      select: teamSeasonCategorySelect,
    });

    return {
      data: newCategory,
      message: 'Categoría añadida exitosamente',
    };
  }

  async findAllByTeamSeason(teamSeasonId: string) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
    });

    if (!teamSeason) {
      throw new NotFoundException('La temporada del equipo no fue encontrada');
    }

    const categories = await this.prisma.teamSeasonCategory.findMany({
      where: { teamSeasonId },
      select: teamSeasonCategorySelect,
      orderBy: {
        category: {
          name: 'asc',
        },
      },
    });

    return {
      data: categories,
      message: 'Categorías obtenidas exitosamente',
    };
  }

  async findOne(teamSeasonId: string, categoryId: string) {
    const category = await this.prisma.teamSeasonCategory.findUnique({
      where: { id: categoryId },
      select: teamSeasonCategorySelect,
    });

    if (!category || category.teamSeasonId !== teamSeasonId) {
      throw new NotFoundException('La categoría no fue encontrada en esta temporada');
    }

    return {
      data: category,
      message: 'Categoría obtenida exitosamente',
    };
  }

  async update(
    teamSeasonId: string,
    categoryId: string,
    updateDto: UpdateTeamSeasonCategoryDto,
  ) {
    const existingCategory = await this.prisma.teamSeasonCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.teamSeasonId !== teamSeasonId) {
      throw new NotFoundException('La categoría no fue encontrada en esta temporada');
    }

    // Validar lógicas de negocio requeridas por el audit
    const minMembers = updateDto.minMembers ?? existingCategory.minMembers;
    const maxMembers = updateDto.maxMembers ?? existingCategory.maxMembers;
    if (minMembers != null && maxMembers != null && minMembers > maxMembers) {
      throw new BadRequestException(
        'El número mínimo de miembros no puede ser mayor al máximo',
      );
    }

    const minBirthYear = updateDto.minBirthYear !== undefined ? updateDto.minBirthYear : existingCategory.minBirthYear;
    const maxBirthYear = updateDto.maxBirthYear !== undefined ? updateDto.maxBirthYear : existingCategory.maxBirthYear;
    
    if (minBirthYear != null && maxBirthYear != null && minBirthYear > maxBirthYear) {
      throw new BadRequestException(
        'El año mínimo de nacimiento no puede ser mayor al año máximo permitido',
      );
    }

    if (updateDto.gender && updateDto.gender !== existingCategory.gender) {
      // Check if duplicate exists
      const duplicate = await this.prisma.teamSeasonCategory.findFirst({
        where: {
          teamSeasonId,
          categoryId: existingCategory.categoryId,
          gender: updateDto.gender,
          NOT: {
            id: categoryId,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          'Ya existe esta categoría con el mismo género en la temporada',
        );
      }
    }

    const updatedCategory = await this.prisma.teamSeasonCategory.update({
      where: { id: categoryId },
      data: updateDto,
      select: teamSeasonCategorySelect,
    });

    return {
      data: updatedCategory,
      message: 'Categoría actualizada exitosamente',
    };
  }

  async activate(teamSeasonId: string, categoryId: string) {
    const existingCategory = await this.prisma.teamSeasonCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.teamSeasonId !== teamSeasonId) {
      throw new NotFoundException('La categoría no fue encontrada en esta temporada');
    }

    if (existingCategory.isActive) {
      throw new BadRequestException('La categoría ya se encuentra activa');
    }

    const activatedCategory = await this.prisma.teamSeasonCategory.update({
      where: { id: categoryId },
      data: { isActive: true },
      select: teamSeasonCategorySelect,
    });

    return {
      data: activatedCategory,
      message: 'Categoría activada exitosamente',
    };
  }

  async deactivate(teamSeasonId: string, categoryId: string) {
    const existingCategory = await this.prisma.teamSeasonCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existingCategory || existingCategory.teamSeasonId !== teamSeasonId) {
      throw new NotFoundException('La categoría no fue encontrada en esta temporada');
    }

    if (!existingCategory.isActive) {
      throw new BadRequestException('La categoría ya se encuentra inactiva');
    }

    const deactivatedCategory = await this.prisma.teamSeasonCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
      select: teamSeasonCategorySelect,
    });

    return {
      data: deactivatedCategory,
      message: 'Categoría desactivada exitosamente',
    };
  }

  async finishEarly(categoryId: string, dto: FinishEarlyTeamSeasonCategoryDto) {
    const endedAt = new Date();
    const endedAtYear = endedAt.getUTCFullYear();
    const endedAtMonth = endedAt.getUTCMonth() + 1;

    return this.prisma.$transaction(async (tx) => {
      // 1. Validar y actualizar categoría (CondiciA3n atA3mica)
      const updateResult = await tx.teamSeasonCategory.updateMany({
        where: {
          id: categoryId,
          status: TeamSeasonCategoryStatus.ACTIVE,
        },
        data: {
          status: TeamSeasonCategoryStatus.FINISHED,
          endedAt,
        },
      });

      if (updateResult.count === 0) {
        // Puede no existir o ya estar terminada. Comprobamos su existencia real
        const existing = await tx.teamSeasonCategory.findUnique({
          where: { id: categoryId },
        });
        if (!existing) {
          throw new NotFoundException('La categoría no fue encontrada');
        }
        throw new ConflictException('La categoría ya se encuentra finalizada');
      }

      // Obtener la categoría actualizada para el response
      const updatedCategory = await tx.teamSeasonCategory.findUnique({
        where: { id: categoryId },
        select: teamSeasonCategorySelect,
      });

      // 2. Obtener membresA-as afectadas
      const affectedMemberships = await tx.playerMembership.findMany({
        where: {
          teamSeasonCategoryId: categoryId,
          status: {
            in: [
              PlayerMembershipStatus.ACTIVE,
              PlayerMembershipStatus.PENDING_ACTIVE,
              PlayerMembershipStatus.SUSPENDED,
            ],
          },
        },
      });

      if (affectedMemberships.length > 0) {
        const membershipIds = affectedMemberships.map((m) => m.id);

        // 3. Finalizar membresA-as
        await tx.playerMembership.updateMany({
          where: { id: { in: membershipIds } },
          data: {
            status: PlayerMembershipStatus.FINISHED,
            endedAt,
            nextRecurringChargeGenerationDate: null,
          },
        });

        // 4. Crear historiales
        await tx.playerMembershipHistory.createMany({
          data: affectedMemberships.map((membership) => ({
            playerMembershipId: membership.id,
            previousStatus: membership.status,
            newStatus: PlayerMembershipStatus.FINISHED,
            reason: dto.notes || 'Finalización anticipada de categoría',
          })),
        });

        // 5. Encontrar cargos futuros (PENDING)
        const pendingCharges = await tx.membershipCharge.findMany({
          where: {
            playerMembershipId: { in: membershipIds },
            charge: {
              status: StatusCharge.PENDING,
            },
          },
          include: {
            charge: true,
          },
        });

        const futureChargeIds = pendingCharges
          .filter((mc) => {
            if (mc.billingYear != null && mc.billingMonth != null) {
              return (
                mc.billingYear > endedAtYear ||
                (mc.billingYear === endedAtYear && mc.billingMonth > endedAtMonth)
              );
            }
            // Fallback
            return mc.charge.dueDate > endedAt;
          })
          .map((mc) => mc.chargeId);

        if (futureChargeIds.length > 0) {
          // 6. Cancelar cargos
          await tx.charge.updateMany({
            where: { id: { in: futureChargeIds } },
            data: {
              status: StatusCharge.CANCELLED,
            },
          });
        }
      }

      return {
        data: updatedCategory,
        message: 'Categoría finalizada anticipadamente con éxito',
      };
    });
  }
}
