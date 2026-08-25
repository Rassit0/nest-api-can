import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateTeamSeasonCategoryDto } from './dto/create-team-season-category.dto';
import { UpdateTeamSeasonCategoryDto } from './dto/update-team-season-category.dto';
import { Prisma, PlayerMembershipStatus } from 'src/generated/prisma/client';

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
}
