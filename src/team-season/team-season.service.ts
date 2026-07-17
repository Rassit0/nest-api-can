import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateTeamSeasonDto } from './dto/create-team-season.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-season.dto';
import { PrismaService } from 'src/prisma.service';
import {
  PlayerMembershipStatus,
  Prisma,
  SeasonBillingType,
  StatusTeamSeason,
  SeasonStatus,
  StatusCharge,
} from 'src/generated/prisma/client';
import { FinalizeTeamSeasonDto } from './dto/finalize-team-season.dto';
import { CancelTeamSeasonDto } from './dto/cancel-team-season.dto';
import { TeamCategorySeasonsPaginationDto } from './dto/pagination.dto';

export const teamCategorySelect: Prisma.TeamSeasonSelect = {
  id: true,
  gender: true,
  team: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      minAge: true,
      maxAge: true,
    },
  },
  season: {
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
    },
  },
  description: true,
  maxMembers: true,
  minMembers: true,
  minBirthYear: true,
  maxBirthYear: true,
  status: true,
  isRegistrationOpen: true,
  billingConfig: true,
  _count: {
    select: {
      playerMemberships: {
        where: {
          OR: [
            {
              status: PlayerMembershipStatus.SUSPENDED,
            },
            {
              status: PlayerMembershipStatus.ACTIVE,
            },
          ],
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class TeamSeasonService {
  private readonly logger = new Logger('TeamCategoriesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamCategoryDto: CreateTeamSeasonDto) {
    const { imageUrl, ...rest } = createTeamCategoryDto;

    const season = await this.prisma.season.findUnique({
      where: { id: createTeamCategoryDto.seasonId },
    });

    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    if (
      season.status === SeasonStatus.FINISHED ||
      season.status === SeasonStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede asignar un equipo a una temporada inactiva o finalizada',
      );
    }

    const category = await this.prisma.category.findUnique({
      where: { id: createTeamCategoryDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }

    if (
      rest.minBirthYear &&
      rest.maxBirthYear &&
      rest.minBirthYear > rest.maxBirthYear
    ) {
      throw new BadRequestException(
        'El año mínimo de nacimiento no puede ser mayor al año máximo permitido',
      );
    }

    if (season.disciplineId !== category.disciplineId) {
      throw new NotFoundException(
        'La temporada y la categoria no pertenecen a la misma disciplina',
      );
    }

    if (rest.billingConfig) {
      if (rest.billingConfig.billingType !== SeasonBillingType.SINGLE_ONLY) {
        if (!rest.billingConfig.recurringFee) {
          throw new BadRequestException(
            'La cuota mensual es requerida si el plan no es de pago único exclusivo',
          );
        }
        if (!rest.billingConfig.registrationFee) {
          throw new BadRequestException(
            'La matrícula es requerida si el plan no es de pago único exclusivo',
          );
        }
      }

      if (
        rest.billingConfig.billingType === SeasonBillingType.SINGLE_ONLY ||
        rest.billingConfig.billingType === SeasonBillingType.BOTH
      ) {
        if (!rest.billingConfig.seasonFee) {
          throw new BadRequestException(
            'La cuota de temporada es requerida si el plan permite pago único',
          );
        }
      }

      if (
        !rest.billingConfig.billingFrequency ||
        rest.billingConfig.billingFrequency === 'MONTHLY'
      ) {
        if (
          rest.billingConfig.billingDay < 1 ||
          rest.billingConfig.billingDay > 28
        ) {
          throw new BadRequestException(
            'El día de facturación mensual debe estar entre 1 y 28',
          );
        }
        const diffTime = season.endDate.getTime() - season.startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Si la temporada dura menos de 28 días, el día de facturación podría no ocurrir nunca
        if (diffDays < 28) {
          let isValidDay = false;
          const current = new Date(season.startDate);
          while (current <= season.endDate) {
            if (current.getUTCDate() === rest.billingConfig.billingDay) {
              isValidDay = true;
              break;
            }
            current.setUTCDate(current.getUTCDate() + 1);
          }
          if (!isValidDay) {
            throw new BadRequestException(
              'El día de facturación seleccionado no ocurre dentro de las fechas de esta temporada.',
            );
          }
        }
      } else if (rest.billingConfig.billingFrequency === 'WEEKLY') {
        if (
          rest.billingConfig.billingDay < 1 ||
          rest.billingConfig.billingDay > 7
        ) {
          throw new BadRequestException(
            'El día de facturación semanal debe estar entre 1 y 7',
          );
        }
      } else if (rest.billingConfig.billingFrequency === 'BIWEEKLY') {
        if (
          rest.billingConfig.billingDay < 1 ||
          rest.billingConfig.billingDay > 14
        ) {
          throw new BadRequestException(
            'El día de facturación quincenal debe estar entre 1 y 14',
          );
        }
      }
    }

    const { billingConfig, ...teamSeasonData } = rest;
    const newTeamCategorySeason = await this.prisma.teamSeason.create({
      data: {
        ...teamSeasonData,
        ...(billingConfig ? { billingConfig: { create: billingConfig } } : {}),
      },
      select: teamCategorySelect,
    });

    return {
      message: 'Temporada asignada a equipo exitosamente',
      data: newTeamCategorySeason,
    };
  }

  async findAll(paginationDto: TeamCategorySeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      gender,
      teamId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.TeamSeasonWhereInput = search
      ? {
          OR: [
            { team: { name: { contains: search, mode: 'insensitive' } } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    if (teamId) {
      where.teamId = teamId;
    }

    if (gender) {
      where.gender = gender;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [teamCategorieSeasons, totalItems] = await Promise.all([
      this.prisma.teamSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: teamCategorySelect,
      }),
      this.prisma.teamSeason.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Temporadas de equipo obtenidas exitosamente',
      data: teamCategorieSeasons, // Será [] si la página no existe o no hay registros
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
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: teamCategorySelect,
    });

    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }

    return {
      data: teamSeason,
      message: 'Temporada de equipo obtenida exitosamente',
    };
  }

  async getSummary(id: string) {
    const [
      teamSeason,
      chargesAggr,
      activeMembers,
      suspendedMembers,
      pendingMembers,
    ] = await Promise.all([
      this.prisma.teamSeason.findUnique({
        where: { id },
        select: { id: true, maxMembers: true },
      }),
      this.prisma.charge.aggregate({
        where: {
          membershipCharges: {
            some: { playerMembership: { teamSeasonId: id } },
          },
        },
        _sum: { amount: true, pendingAmount: true },
      }),
      this.prisma.playerMembership.count({
        where: { teamSeasonId: id, status: 'ACTIVE' },
      }),
      this.prisma.playerMembership.count({
        where: { teamSeasonId: id, status: 'SUSPENDED' },
      }),
      this.prisma.playerMembership.count({
        where: { teamSeasonId: id, status: 'PENDING_ACTIVE' },
      }),
    ]);

    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }

    const totalBilled = Number(chargesAggr._sum.amount || 0);
    const totalPending = Number(chargesAggr._sum.pendingAmount || 0);
    const totalPaid = totalBilled - totalPending;

    return {
      data: {
        totalBilled,
        totalPaid,
        totalPending,
        activeMembers,
        suspendedMembers,
        pendingMembers,
        occupiedSlotsCount: activeMembers + suspendedMembers + pendingMembers,
        maxMembers: teamSeason.maxMembers,
      },
      message: 'Resumen de la temporada de equipo obtenido exitosamente',
    };
  }

  async update(id: string, updateTeamSeasonDto: UpdateTeamSeasonDto) {
    const { teamId, categoryId, seasonId, imageUrl, ...rest } =
      updateTeamSeasonDto;
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: teamCategorySelect,
    });
    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }

    if (
      teamSeason.status === StatusTeamSeason.FINISHED ||
      teamSeason.status === StatusTeamSeason.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede editar una temporada de equipo que ya finalizó o fue cancelada',
      );
    }

    if (teamSeason.status === StatusTeamSeason.ACTIVE) {
      if (
        (teamId && teamId !== teamSeason.team.id) ||
        (seasonId && seasonId !== teamSeason.season.id) ||
        (categoryId && categoryId !== teamSeason.category.id) ||
        (updateTeamSeasonDto.gender && updateTeamSeasonDto.gender !== teamSeason.gender)
      ) {
        throw new BadRequestException(
          'No se puede modificar el equipo, la temporada, la categoría ni el género una vez que la temporada de equipo está activa',
        );
      }

      const billing = updateTeamSeasonDto.billingConfig;
      if (billing && teamSeason.billingConfig) {
        if (
          (billing.billingType !== undefined && billing.billingType !== teamSeason.billingConfig.billingType) ||
          (billing.billingFrequency !== undefined && billing.billingFrequency !== teamSeason.billingConfig.billingFrequency) ||
          (billing.billingDay !== undefined && billing.billingDay !== teamSeason.billingConfig.billingDay) ||
          (billing.prorateRegistrationFee !== undefined && billing.prorateRegistrationFee !== teamSeason.billingConfig.prorateRegistrationFee) ||
          (billing.prorateFirstRecurringFee !== undefined && billing.prorateFirstRecurringFee !== teamSeason.billingConfig.prorateFirstRecurringFee) ||
          (billing.prorateLastRecurringFee !== undefined && billing.prorateLastRecurringFee !== teamSeason.billingConfig.prorateLastRecurringFee) ||
          (billing.prorateSeasonFee !== undefined && billing.prorateSeasonFee !== teamSeason.billingConfig.prorateSeasonFee)
        ) {
          throw new BadRequestException(
            'No se puede modificar la configuración base del motor de cobros (tipo, frecuencia, día y prorrateos) en una temporada activa. Solo se permite actualizar montos para nuevas inscripciones.',
          );
        }
      }
    }

    let season = await this.prisma.season.findUnique({
      where: { id: seasonId ? seasonId : teamSeason.season.id },
    });

    let category = await this.prisma.category.findUnique({
      where: { id: categoryId ? categoryId : teamSeason.category.id },
    });

    if (updateTeamSeasonDto.seasonId) {
      season = await this.prisma.season.findUnique({
        where: { id: updateTeamSeasonDto.seasonId },
      });
    }

    if (updateTeamSeasonDto.categoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: updateTeamSeasonDto.categoryId },
      });
    }

    if (!season) {
      throw new NotFoundException('La temporada no fue encontrada');
    }

    if (
      season.status === SeasonStatus.FINISHED ||
      season.status === SeasonStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede actualizar ni reasignar un equipo a una temporada inactiva o finalizada',
      );
    }
    if (!category) {
      throw new NotFoundException('La categoria no fue encontrada');
    }

    if (season.disciplineId !== category.disciplineId) {
      throw new NotFoundException(
        'La temporada y la categoria no pertenecen a la misma disciplina',
      );
    }

    const minBirthYear =
      rest.minBirthYear !== undefined
        ? rest.minBirthYear
        : teamSeason.minBirthYear;
    const maxBirthYear =
      rest.maxBirthYear !== undefined
        ? rest.maxBirthYear
        : teamSeason.maxBirthYear;

    if (minBirthYear && maxBirthYear && minBirthYear > maxBirthYear) {
      throw new BadRequestException(
        'El año mínimo de nacimiento no puede ser mayor al año máximo permitido',
      );
    }

    if (
      rest.maxMembers !== undefined &&
      rest.maxMembers < teamSeason.maxMembers
    ) {
      const activeMembersCount = await this.prisma.playerMembership.count({
        where: {
          teamSeasonId: id,
          status: {
            in: ['ACTIVE', 'PENDING_ACTIVE', 'SUSPENDED'],
          },
        },
      });

      if (rest.maxMembers < activeMembersCount) {
        throw new BadRequestException(
          `No se pueden reducir los cupos máximos a ${rest.maxMembers} porque ya hay ${activeMembersCount} jugadores ocupando un cupo.`,
        );
      }
    }

    if (rest.billingConfig) {
      const currentBillingConfig = teamSeason.billingConfig;
      const targetBillingType =
        rest.billingConfig.billingType ?? currentBillingConfig?.billingType;

      if (targetBillingType !== SeasonBillingType.SINGLE_ONLY) {
        const finalRecurringFee =
          rest.billingConfig.recurringFee !== undefined
            ? rest.billingConfig.recurringFee
            : currentBillingConfig?.recurringFee;

        const finalRegistrationFee =
          rest.billingConfig.registrationFee !== undefined
            ? rest.billingConfig.registrationFee
            : currentBillingConfig?.registrationFee;

        if (!finalRecurringFee) {
          throw new BadRequestException(
            'La cuota mensual es requerida si el plan no es de pago único exclusivo',
          );
        }
        if (!finalRegistrationFee) {
          throw new BadRequestException(
            'La matrícula es requerida si el plan no es de pago único exclusivo',
          );
        }
      }

      if (
        targetBillingType === SeasonBillingType.SINGLE_ONLY ||
        targetBillingType === SeasonBillingType.BOTH
      ) {
        const finalSeasonFee =
          rest.billingConfig.seasonFee !== undefined
            ? rest.billingConfig.seasonFee
            : currentBillingConfig?.seasonFee;

        if (!finalSeasonFee) {
          throw new BadRequestException(
            'La cuota de temporada es requerida si el plan permite pago único',
          );
        }
      }
    }

    const { billingConfig, ...teamSeasonData } = rest;

    const updatedTeamCategory = await this.prisma.teamSeason.update({
      where: { id },
      data: {
        ...teamSeasonData,
        teamId,
        seasonId,
        categoryId,
        ...(billingConfig
          ? {
              billingConfig: {
                upsert: {
                  create: billingConfig,
                  update: billingConfig,
                },
              },
            }
          : {}),
      },
      select: teamCategorySelect,
    });
    return {
      message: 'Temporada de equipo actualizada exitosamente',
      data: updatedTeamCategory,
    };
  }

  async getSeasonsOptions() {
    const seasons = await this.prisma.season.findMany({
      where: {
        status: SeasonStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      data: seasons,
      message: 'Temporadas obtenidas exitosamente',
    };
  }

  async getCategoriesByDisciplineOptions(disciplineId: string) {
    const categories = await this.prisma.category.findMany({
      where: { disciplineId },
      select: {
        id: true,
        name: true,
        minAge: true,
        maxAge: true,
      },
    });

    return {
      data: categories,
      message: 'Categorias obtenidas exitosamente',
    };
  }
  async getSeasonsByDisciplineOptions(disciplineId: string) {
    const seasons = await this.prisma.season.findMany({
      where: {
        disciplineId,
        status: SeasonStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    return {
      data: seasons,
      message: 'Temporadas obtenidas exitosamente',
    };
  }

  async remove(id: string) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        playerMemberships: true,
      },
    });
    if (!teamSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }
    if (teamSeason.status !== StatusTeamSeason.DRAFT) {
      throw new BadRequestException(
        'La temporada de equipo no puede ser eliminada',
      );
    }
    if (teamSeason.playerMemberships?.length > 0) {
      throw new BadRequestException(
        'La temporada no puede ser eliminada porque tiene registros asociados',
      );
    }
    await this.prisma.teamSeason.delete({
      where: { id },
    });
    return {
      message: 'Temporada de equipo eliminada exitosamente',
      data: teamSeason,
    };
  }

  async finish(id: string, finalizeTeamSeasonDto: FinalizeTeamSeasonDto) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!teamSeason) {
      throw new NotFoundException('La temporada de equipo no fue encontrada');
    }

    if (teamSeason.status === StatusTeamSeason.ACTIVE) {
      const updatedTeamSeason = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.teamSeason.update({
          where: { id },
          data: {
            status: StatusTeamSeason.FINISHED,
            statusNotes: finalizeTeamSeasonDto.reason,
          },
          select: teamCategorySelect,
        });

        // Actualizar membresías activas o suspendidas a FINISHED
        await tx.playerMembership.updateMany({
          where: {
            teamSeasonId: id,
            status: {
              in: [
                PlayerMembershipStatus.ACTIVE,
                PlayerMembershipStatus.SUSPENDED,
                PlayerMembershipStatus.PENDING_ACTIVE,
              ],
            },
          },
          data: { status: PlayerMembershipStatus.FINISHED },
        });

        return updated;
      });

      return {
        message: 'Temporada de equipo finalizada exitosamente',
        data: updatedTeamSeason,
      };
    } else {
      throw new BadRequestException(
        'Solo una temporada de equipo activa puede ser finalizada',
      );
    }
  }

  async cancel(id: string, cancelTeamSeasonDto: CancelTeamSeasonDto) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!teamSeason) {
      throw new NotFoundException('La temporada de equipo no fue encontrada');
    }

    if (
      teamSeason.status === StatusTeamSeason.ACTIVE ||
      teamSeason.status === StatusTeamSeason.DRAFT
    ) {
      const updatedTeamSeason = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.teamSeason.update({
          where: { id },
          data: {
            status: StatusTeamSeason.CANCELLED,
            statusNotes: cancelTeamSeasonDto.reason,
          },
          select: teamCategorySelect,
        });

        if (teamSeason.status === StatusTeamSeason.ACTIVE) {
          const memberships = await tx.playerMembership.findMany({
            where: {
              teamSeasonId: id,
              status: {
                in: [
                  PlayerMembershipStatus.ACTIVE,
                  PlayerMembershipStatus.SUSPENDED,
                  PlayerMembershipStatus.PENDING_ACTIVE,
                ],
              },
            },
            select: { id: true },
          });

          const membershipIds = memberships.map((m) => m.id);

          if (membershipIds.length > 0) {
            // Encontrar todos los cargos pendientes de estas membresías
            const membershipCharges = await tx.membershipCharge.findMany({
              where: {
                playerMembershipId: { in: membershipIds },
                charge: { status: StatusCharge.PENDING },
              },
              select: { chargeId: true },
            });

            const chargeIds = membershipCharges.map((mc) => mc.chargeId);

            if (chargeIds.length > 0) {
              // Cancelar cargos pendientes
              await tx.charge.updateMany({
                where: { id: { in: chargeIds } },
                data: { status: StatusCharge.CANCELLED },
              });
            }

            // Cambiar estado de las membresías a WITHDRAWN
            await tx.playerMembership.updateMany({
              where: { id: { in: membershipIds } },
              data: { status: PlayerMembershipStatus.WITHDRAWN },
            });
          }
        }

        return updated;
      });

      return {
        message: 'Temporada de equipo cancelada exitosamente',
        data: updatedTeamSeason,
      };
    } else {
      throw new BadRequestException(
        'Esta temporada de equipo no puede ser cancelada',
      );
    }
  }

  async toggleBillingEngine(id: string, isEngineActive: boolean) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id },
      include: { billingConfig: true },
    });
    if (!teamSeason || !teamSeason.billingConfig) {
      throw new NotFoundException(
        'La configuración de cobros para esta temporada no fue encontrada',
      );
    }

    const updated = await this.prisma.teamSeasonBillingConfig.update({
      where: { teamSeasonId: id },
      data: { isEngineActive },
    });

    return {
      message: `Motor de cobros ${isEngineActive ? 'activado' : 'pausado'} exitosamente`,
      data: updated,
    };
  }

  async getPauses(teamSeasonId: string) {
    const pauses = await this.prisma.teamSeasonPause.findMany({
      where: { teamSeasonId },
      orderBy: { startDate: 'desc' },
    });
    return { data: pauses, message: 'Pausas obtenidas' };
  }

  async addPause(
    teamSeasonId: string,
    createPauseDto: { startDate: string; endDate: string; reason?: string },
  ) {
    const teamSeason = await this.prisma.teamSeason.findUnique({
      where: { id: teamSeasonId },
      include: { season: true },
    });

    if (!teamSeason) throw new BadRequestException('Team season not found');

    const startDate = new Date(createPauseDto.startDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(createPauseDto.endDate);
    endDate.setUTCHours(23, 59, 59, 999);

    if (startDate > endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior o igual a la de fin',
      );
    }

    if (
      startDate < teamSeason.season.startDate ||
      endDate > teamSeason.season.endDate
    ) {
      throw new BadRequestException(
        `Las fechas de la pausa deben estar dentro del rango de la temporada (${teamSeason.season.startDate.toISOString().split('T')[0]} - ${teamSeason.season.endDate.toISOString().split('T')[0]})`,
      );
    }

    const overlapping = await this.prisma.teamSeasonPause.findFirst({
      where: {
        teamSeasonId,
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Ya existe una pausa para este equipo en estas fechas (${overlapping.startDate.toISOString().split('T')[0]} - ${overlapping.endDate.toISOString().split('T')[0]})`,
      );
    }

    const pause = await this.prisma.teamSeasonPause.create({
      data: {
        teamSeasonId,
        startDate,
        endDate,
        reason: createPauseDto.reason,
      },
    });

    return { message: 'Pausa agregada correctamente', data: pause };
  }

  async removePause(id: string) {
    const pause = await this.prisma.teamSeasonPause.findUnique({
      where: { id },
    });
    if (!pause) throw new BadRequestException('Pausa no encontrada');
    await this.prisma.teamSeasonPause.delete({
      where: { id },
    });

    return { message: 'Pausa eliminada correctamente' };
  }

  async findPublic(isHistorical?: boolean) {
    const status = isHistorical ? StatusTeamSeason.FINISHED : StatusTeamSeason.ACTIVE;
    
    const teamSeasons = await this.prisma.teamSeason.findMany({
      where: {
        status,
        ...(isHistorical ? {} : { isRegistrationOpen: true })
      },
      select: {
        id: true,
        gender: true,
        minBirthYear: true,
        maxBirthYear: true,
        maxMembers: true,
        description: true,
        team: {
          select: {
            name: true,
            club: { select: { name: true } },
          }
        },
        category: { 
          select: { 
            name: true, 
            minAge: true, 
            maxAge: true,
            discipline: { select: { name: true } }
          } 
        },
        billingConfig: { 
          select: { 
            registrationFee: true, 
            recurringFee: true, 
            seasonFee: true, 
            billingType: true 
          } 
        },
        _count: {
          select: {
            playerMemberships: {
              where: {
                status: { in: ['ACTIVE', 'SUSPENDED'] }
              }
            }
          }
        }
      }
    });

    const mapped = teamSeasons.map(ts => {
      let regFee = 0;
      let monthFee = 0;
      if (ts.billingConfig) {
        regFee = Number(ts.billingConfig.registrationFee || 0);
        if (ts.billingConfig.billingType === 'SINGLE_ONLY') {
          monthFee = Number(ts.billingConfig.seasonFee || 0);
        } else {
          monthFee = Number(ts.billingConfig.recurringFee || 0);
        }
      }

      return {
        id: ts.id,
        name: ts.team.name,
        discipline: ts.category.discipline.name,
        club: ts.team.club.name,
        gender: ts.gender === 'MALE' ? 'Masculino' : ts.gender === 'FEMALE' ? 'Femenino' : 'Mixto',
        minAge: ts.category.minAge,
        maxAge: ts.category.maxAge,
        category: ts.category.name,
        tournament: ts.description || 'Competencia local',
        capacity: ts.maxMembers,
        enrolled: ts._count.playerMemberships,
        registrationFee: regFee,
        monthlyFee: monthFee,
      };
    });

    return {
      message: 'Equipos p�blicos obtenidos exitosamente',
      data: mapped
    };
  }
}
