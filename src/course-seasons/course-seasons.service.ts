import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseSeasonDto } from './dto/create-course-season.dto';
import { UpdateCourseSeasonDto } from './dto/update-course-season.dto';
import { PrismaService } from 'src/prisma.service';
import {
  StudentMembershipStatus,
  Prisma,
  SeasonBillingType,
  StatusCourseSeason,
  SeasonStatus,
  StatusCharge,
} from 'src/generated/prisma/client';
import { FinalizeCourseSeasonDto } from './dto/finalize-course-season.dto';
import { CancelCourseSeasonDto } from './dto/cancel-course-season.dto';
import { CourseSeasonsPaginationDto } from './dto/pagination.dto';

export const courseSeasonSelect: Prisma.CourseSeasonSelect = {
  id: true,
  imageUrl: true,
  gender: true,
  course: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      school: {
        select: {
          id: true,
          name: true,
        },
      },
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
  billingConfig: true,
  isRegistrationOpen: true,
  courseSeasonStaffs: {
    select: {
      id: true,
      role: true,
      isPrimary: true,
      startedAt: true,
      endedAt: true,
      staff: {
        select: {
          id: true,
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
              secondLastName: true,
              imageUrl: true,
              documentNumber: true,
            },
          },
        },
      },
    },
  },
  _count: {
    select: {
      studentMemberships: {
        where: {
          OR: [
            { status: StudentMembershipStatus.SUSPENDED },
            { status: StudentMembershipStatus.ACTIVE },
          ],
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class CourseSeasonsService {
  private readonly logger = new Logger('CourseCategoriesService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createCourseCategoryDto: CreateCourseSeasonDto) {
    const { imageUrl, ...rest } = createCourseCategoryDto;

    const season = await this.prisma.season.findUnique({
      where: { id: createCourseCategoryDto.seasonId },
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
      where: { id: createCourseCategoryDto.categoryId },
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

    const { billingConfig, ...courseSeasonData } = rest;
    const newCourseSeason = await this.prisma.courseSeason.create({
      data: {
        ...courseSeasonData,
        ...(billingConfig ? { billingConfig: { create: billingConfig } } : {}),
      },
      select: courseSeasonSelect,
    });

    return {
      message: 'Temporada asignada a equipo exitosamente',
      data: newCourseSeason,
    };
  }

  async findAll(paginationDto: CourseSeasonsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'createdAt',
      gender,
      courseId,
    } = paginationDto;
    // Calcular el offset para la paginación
    const skip = (page - 1) * per_page;

    const where: Prisma.CourseSeasonWhereInput = search
      ? {
          OR: [
            { course: { name: { contains: search, mode: 'insensitive' } } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    if (courseId) {
      where.courseId = courseId;
    }

    if (gender) {
      where.gender = gender;
    }

    // Ejecutamos ambas consultas en paralelo para máxima velocidad
    const [courseCategorieSeasons, totalItems] = await Promise.all([
      this.prisma.courseSeason.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: courseSeasonSelect,
      }),
      this.prisma.courseSeason.count({ where }),
    ]);

    // Lógica de metadatos
    const totalPages = Math.ceil(totalItems / per_page);

    // Si el usuario pide un page que no existe, Prisma ya puso [] en 'disciplines'.
    // Calculamos la página actual basándonos en el page solicitado.
    const currentPage = totalItems === 0 ? 0 : Math.floor(page / per_page) + 1;

    return {
      message: 'Temporadas de equipo obtenidas exitosamente',
      data: courseCategorieSeasons, // Será [] si la página no existe o no hay registros
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
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: courseSeasonSelect,
    });

    if (!courseSeason) {
      throw new NotFoundException(
        'La categoria de curso en temporada no fue encontrada',
      );
    }

    return {
      data: courseSeason,
      message: 'Temporada de curso obtenida exitosamente',
    };
  }

  async getSummary(id: string) {
    const [
      courseSeason,
      chargesAggr,
      activeMembers,
      suspendedMembers,
      pendingMembers,
    ] = await Promise.all([
      this.prisma.courseSeason.findUnique({
        where: { id },
        select: { id: true, maxMembers: true },
      }),
      this.prisma.charge.aggregate({
        where: {
          studentCharges: {
            some: { studentMembership: { courseSeasonId: id } },
          },
        },
        _sum: { amount: true, pendingAmount: true },
      }),
      this.prisma.studentMembership.count({
        where: { courseSeasonId: id, status: 'ACTIVE' },
      }),
      this.prisma.studentMembership.count({
        where: { courseSeasonId: id, status: 'SUSPENDED' },
      }),
      this.prisma.studentMembership.count({
        where: { courseSeasonId: id, status: 'PENDING_ACTIVE' },
      }),
    ]);

    if (!courseSeason) {
      throw new NotFoundException(
        'La categoria de curso en temporada no fue encontrada',
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
        maxMembers: courseSeason.maxMembers,
      },
      message: 'Resumen de la temporada de curso obtenido exitosamente',
    };
  }

  async update(id: string, updateCourseSeasonDto: UpdateCourseSeasonDto) {
    const { courseId, categoryId, seasonId, imageUrl, ...rest } =
      updateCourseSeasonDto;
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: courseSeasonSelect,
    });
    if (!courseSeason) {
      throw new NotFoundException(
        'La categoria de curso en temporada no fue encontrada',
      );
    }

    if (
      courseSeason.status === StatusCourseSeason.FINISHED ||
      courseSeason.status === StatusCourseSeason.CANCELLED
    ) {
      throw new BadRequestException(
        'No se puede editar una temporada de curso que ya finalizó o fue cancelada',
      );
    }

    if (courseSeason.status === StatusCourseSeason.ACTIVE) {
      if (
        (courseId && courseId !== courseSeason.course.id) ||
        (seasonId && seasonId !== courseSeason.season.id) ||
        (categoryId && categoryId !== courseSeason.category.id) ||
        (updateCourseSeasonDto.gender &&
          updateCourseSeasonDto.gender !== courseSeason.gender)
      ) {
        throw new BadRequestException(
          'No se puede modificar el curso, la temporada, la categoría ni el género una vez que la temporada de curso está activa',
        );
      }

      const billing = updateCourseSeasonDto.billingConfig;
      if (billing && courseSeason.billingConfig) {
        if (
          (billing.billingType !== undefined &&
            billing.billingType !== courseSeason.billingConfig.billingType) ||
          (billing.billingFrequency !== undefined &&
            billing.billingFrequency !==
              courseSeason.billingConfig.billingFrequency) ||
          (billing.billingDay !== undefined &&
            billing.billingDay !== courseSeason.billingConfig.billingDay) ||
          (billing.prorateRegistrationFee !== undefined &&
            billing.prorateRegistrationFee !==
              courseSeason.billingConfig.prorateRegistrationFee) ||
          (billing.prorateFirstRecurringFee !== undefined &&
            billing.prorateFirstRecurringFee !==
              courseSeason.billingConfig.prorateFirstRecurringFee) ||
          (billing.prorateLastRecurringFee !== undefined &&
            billing.prorateLastRecurringFee !==
              courseSeason.billingConfig.prorateLastRecurringFee) ||
          (billing.prorateSeasonFee !== undefined &&
            billing.prorateSeasonFee !==
              courseSeason.billingConfig.prorateSeasonFee)
        ) {
          throw new BadRequestException(
            'No se puede modificar la configuración base del motor de cobros (tipo, frecuencia, día y prorrateos) en una temporada activa. Solo se permite actualizar montos para nuevas inscripciones.',
          );
        }
      }
    }

    let season = await this.prisma.season.findUnique({
      where: { id: seasonId ? seasonId : courseSeason.season.id },
    });

    let category = await this.prisma.category.findUnique({
      where: { id: categoryId ? categoryId : courseSeason.category.id },
    });

    if (updateCourseSeasonDto.seasonId) {
      season = await this.prisma.season.findUnique({
        where: { id: updateCourseSeasonDto.seasonId },
      });
    }

    if (updateCourseSeasonDto.categoryId) {
      category = await this.prisma.category.findUnique({
        where: { id: updateCourseSeasonDto.categoryId },
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
        : courseSeason.minBirthYear;
    const maxBirthYear =
      rest.maxBirthYear !== undefined
        ? rest.maxBirthYear
        : courseSeason.maxBirthYear;

    if (minBirthYear && maxBirthYear && minBirthYear > maxBirthYear) {
      throw new BadRequestException(
        'El año mínimo de nacimiento no puede ser mayor al año máximo permitido',
      );
    }

    if (
      rest.maxMembers !== undefined &&
      rest.maxMembers < courseSeason.maxMembers
    ) {
      const activeMembersCount = await this.prisma.studentMembership.count({
        where: {
          courseSeasonId: id,
          status: {
            in: ['ACTIVE', 'PENDING_ACTIVE', 'SUSPENDED'],
          },
        },
      });

      if (rest.maxMembers < activeMembersCount) {
        throw new BadRequestException(
          `No se pueden reducir los cupos máximos a ${rest.maxMembers} porque ya hay ${activeMembersCount} estudiantes ocupando un cupo.`,
        );
      }
    }

    if (rest.billingConfig) {
      const currentBillingConfig = courseSeason.billingConfig;
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

    const { billingConfig, ...courseSeasonData } = rest;

    const updatedCourseCategory = await this.prisma.courseSeason.update({
      where: { id },
      data: {
        ...courseSeasonData,
        courseId,
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
      select: courseSeasonSelect,
    });
    return {
      message: 'Temporada de equipo actualizada exitosamente',
      data: updatedCourseCategory,
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
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        studentMemberships: true,
      },
    });
    if (!courseSeason) {
      throw new NotFoundException(
        'La categoria de equipo en temporada no fue encontrada',
      );
    }
    if (courseSeason.status !== StatusCourseSeason.DRAFT) {
      throw new BadRequestException(
        'La temporada de equipo no puede ser eliminada',
      );
    }
    if (courseSeason.studentMemberships?.length > 0) {
      throw new BadRequestException(
        'La temporada no puede ser eliminada porque tiene registros asociados',
      );
    }
    await this.prisma.courseSeason.delete({
      where: { id },
    });
    return {
      message: 'Temporada de equipo eliminada exitosamente',
      data: courseSeason,
    };
  }

  async finish(id: string, finalizeCourseSeasonDto: FinalizeCourseSeasonDto) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!courseSeason) {
      throw new NotFoundException('La temporada de equipo no fue encontrada');
    }

    if (courseSeason.status === StatusCourseSeason.ACTIVE) {
      const updatedCourseSeason = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.courseSeason.update({
          where: { id },
          data: {
            status: StatusCourseSeason.FINISHED,
          },
          select: courseSeasonSelect,
        });

        // Actualizar membresías activas o suspendidas a FINISHED
        await tx.studentMembership.updateMany({
          where: {
            courseSeasonId: id,
            status: {
              in: [
                StudentMembershipStatus.ACTIVE,
                StudentMembershipStatus.SUSPENDED,
                StudentMembershipStatus.ACTIVE,
              ],
            },
          },
          data: { status: StudentMembershipStatus.FINISHED },
        });

        return updated;
      });

      return {
        message: 'Temporada de equipo finalizada exitosamente',
        data: updatedCourseSeason,
      };
    } else {
      throw new BadRequestException(
        'Solo una temporada de equipo activa puede ser finalizada',
      );
    }
  }

  async cancel(id: string, cancelCourseSeasonDto: CancelCourseSeasonDto) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!courseSeason) {
      throw new NotFoundException('La temporada de equipo no fue encontrada');
    }

    if (
      courseSeason.status === StatusCourseSeason.ACTIVE ||
      courseSeason.status === StatusCourseSeason.DRAFT
    ) {
      const updatedCourseSeason = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.courseSeason.update({
          where: { id },
          data: {
            status: StatusCourseSeason.CANCELLED,
          },
          select: courseSeasonSelect,
        });

        if (courseSeason.status === StatusCourseSeason.ACTIVE) {
          const memberships = await tx.studentMembership.findMany({
            where: {
              courseSeasonId: id,
              status: {
                in: [
                  StudentMembershipStatus.ACTIVE,
                  StudentMembershipStatus.SUSPENDED,
                  StudentMembershipStatus.ACTIVE,
                ],
              },
            },
            select: { id: true },
          });

          const membershipIds = memberships.map((m) => m.id);

          if (membershipIds.length > 0) {
            // Encontrar todos los cargos pendientes de estas membresías
            const membershipCharges = await tx.studentCharge.findMany({
              where: {
                studentMembershipId: { in: membershipIds },
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
            await tx.studentMembership.updateMany({
              where: { id: { in: membershipIds } },
              data: { status: StudentMembershipStatus.WITHDRAWN },
            });
          }
        }

        return updated;
      });

      return {
        message: 'Temporada de equipo cancelada exitosamente',
        data: updatedCourseSeason,
      };
    } else {
      throw new BadRequestException(
        'Esta temporada de equipo no puede ser cancelada',
      );
    }
  }

  async toggleBillingEngine(id: string, isEngineActive: boolean) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id },
      include: { billingConfig: true },
    });
    if (!courseSeason || !courseSeason.billingConfig) {
      throw new NotFoundException(
        'La configuración de cobros para esta temporada no fue encontrada',
      );
    }

    const updated = await this.prisma.courseSeasonBillingConfig.update({
      where: { courseSeasonId: id },
      data: { isEngineActive },
    });

    return {
      message: `Motor de cobros ${isEngineActive ? 'activado' : 'pausado'} exitosamente`,
      data: updated,
    };
  }

  async getPauses(courseSeasonId: string) {
    const pauses = await this.prisma.courseSeasonPause.findMany({
      where: { courseSeasonId },
      orderBy: { startDate: 'desc' },
    });
    return { data: pauses, message: 'Pausas obtenidas' };
  }

  async addPause(
    courseSeasonId: string,
    createPauseDto: { startDate: string; endDate: string; reason?: string },
  ) {
    const courseSeason = await this.prisma.courseSeason.findUnique({
      where: { id: courseSeasonId },
      include: { season: true },
    });

    if (!courseSeason) throw new BadRequestException('Course season not found');

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
      startDate < courseSeason.season.startDate ||
      endDate > courseSeason.season.endDate
    ) {
      throw new BadRequestException(
        `Las fechas de la pausa deben estar dentro del rango de la temporada (${courseSeason.season.startDate.toISOString().split('T')[0]} - ${courseSeason.season.endDate.toISOString().split('T')[0]})`,
      );
    }

    const overlapping = await this.prisma.courseSeasonPause.findFirst({
      where: {
        courseSeasonId,
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Ya existe una pausa para este equipo en estas fechas (${overlapping.startDate.toISOString().split('T')[0]} - ${overlapping.endDate.toISOString().split('T')[0]})`,
      );
    }

    const pause = await this.prisma.courseSeasonPause.create({
      data: {
        courseSeasonId,
        startDate,
        endDate,
        reason: createPauseDto.reason,
      },
    });

    return { message: 'Pausa agregada correctamente', data: pause };
  }

  async removePause(id: string) {
    const pause = await this.prisma.courseSeasonPause.findUnique({
      where: { id },
    });
    if (!pause) throw new BadRequestException('Pausa no encontrada');

    await this.prisma.courseSeasonPause.delete({
      where: { id },
    });

    return { message: 'Pausa eliminada correctamente' };
  }
}
