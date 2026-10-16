import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateProgressEvaluationDto } from './dto/create-progress-evaluation.dto';
import { UpdateProgressEvaluationDto } from './dto/update-progress-evaluation.dto';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { ProgressEvaluationsPaginationDto } from './dto/pagination.dto';
import { createPaginationResult } from 'src/common/helpers/pagination.helper';

export const progressEvaluationSelect: Prisma.ProgressEvaluationSelect = {
  id: true,
  evaluationDate: true,
  technicalScore: true,
  tacticalScore: true,
  physicalScore: true,
  behaviorScore: true,
  notes: true,
  courseSeasonShiftId: true,
  teamSeasonCategoryId: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      name: true,
    },
  },
  courseSeasonShift: {
    select: {
      id: true,
      courseSeason: {
        select: {
          id: true,
          name: true,
          course: { select: { id: true, name: true } },
        },
      },
      shift: { select: { id: true, name: true } },
    },
  },
  teamSeasonCategory: {
    select: {
      id: true,
      teamSeason: {
        select: {
          id: true,
          team: { select: { id: true, name: true } },
        },
      },
      category: { select: { id: true, name: true } },
    },
  },
  evaluatorStaff: {
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
    },
  },
  player: {
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
    },
  },
  student: {
    select: {
      id: true,
      person: {
        select: {
          id: true,
          name: true,
          lastName: true,
        },
      },
    },
  },
};

@Injectable()
export class ProgressEvaluationsService {
  private readonly logger = new Logger('ProgressEvaluationsService');

  constructor(private readonly prisma: PrismaService) {}

  async create(createProgressEvaluationDto: CreateProgressEvaluationDto) {
    const {
      playerId,
      studentId,
      courseSeasonShiftId,
      teamSeasonCategoryId,
      evaluatorStaffId,
      evaluationDate,
      technicalScore,
      tacticalScore,
      physicalScore,
      behaviorScore,
      notes,
    } = createProgressEvaluationDto;

    let derivedSeasonId = createProgressEvaluationDto.seasonId;

    if (studentId) {
      if (playerId) {
        throw new BadRequestException(
          'Una evaluación no puede asociarse simultáneamente a un estudiante y a un jugador',
        );
      }
      if (teamSeasonCategoryId) {
        throw new BadRequestException(
          'Un estudiante no puede asociarse a una categoría de equipo',
        );
      }
      if (!courseSeasonShiftId) {
        throw new BadRequestException(
          'Debe especificar el turno escolar (courseSeasonShiftId) para evaluar a un estudiante',
        );
      }

      const shift = await this.prisma.courseSeasonShift.findUnique({
        where: { id: courseSeasonShiftId },
        include: { courseSeason: true },
      });

      if (!shift) {
        throw new NotFoundException('El turno escolar especificado no existe');
      }

      const groupSeasonId = shift.courseSeason.seasonId;
      if (derivedSeasonId && derivedSeasonId !== groupSeasonId) {
        throw new BadRequestException(
          'La temporada especificada no coincide con la temporada del turno escolar',
        );
      }
      derivedSeasonId = groupSeasonId;

      const membership = await this.prisma.studentMembership.findFirst({
        where: {
          studentId,
          courseSeasonShiftId,
          status: { in: ['ACTIVE', 'PENDING_ACTIVE'] },
        },
      });

      if (!membership) {
        throw new BadRequestException(
          'El estudiante no posee una matrícula válida en el turno escolar especificado',
        );
      }
    } else if (playerId) {
      if (courseSeasonShiftId) {
        throw new BadRequestException(
          'Un jugador no puede asociarse a un turno de escuela deportiva',
        );
      }
      if (!teamSeasonCategoryId) {
        throw new BadRequestException(
          'Debe especificar la categoría de equipo (teamSeasonCategoryId) para evaluar a un jugador',
        );
      }

      const category = await this.prisma.teamSeasonCategory.findUnique({
        where: { id: teamSeasonCategoryId },
        include: { teamSeason: true },
      });

      if (!category) {
        throw new NotFoundException(
          'La categoría de equipo especificada no existe',
        );
      }

      const groupSeasonId = category.teamSeason.seasonId;
      if (derivedSeasonId && derivedSeasonId !== groupSeasonId) {
        throw new BadRequestException(
          'La temporada especificada no coincide con la temporada de la categoría de equipo',
        );
      }
      derivedSeasonId = groupSeasonId;

      const membership = await this.prisma.playerMembership.findFirst({
        where: {
          playerId,
          teamSeasonCategoryId,
          status: { in: ['ACTIVE', 'PENDING_ACTIVE'] },
        },
      });

      if (!membership) {
        throw new BadRequestException(
          'El jugador no posee una membresía válida en la categoría de equipo especificada',
        );
      }
    } else {
      throw new BadRequestException(
        'Debe asociar la evaluación a un jugador o a un estudiante',
      );
    }

    const newEvaluation = await this.prisma.progressEvaluation.create({
      data: {
        studentId: studentId || null,
        playerId: playerId || null,
        courseSeasonShiftId: courseSeasonShiftId || null,
        teamSeasonCategoryId: teamSeasonCategoryId || null,
        evaluatorStaffId,
        seasonId: derivedSeasonId,
        evaluationDate,
        technicalScore,
        tacticalScore,
        physicalScore,
        behaviorScore,
        notes,
      },
      select: progressEvaluationSelect,
    });

    return {
      message: 'Evaluación de progreso creada exitosamente',
      data: newEvaluation,
    };
  }

  async findAll(paginationDto: ProgressEvaluationsPaginationDto) {
    const {
      per_page = 10,
      page = 1,
      search,
      orderBy = 'asc',
      sortField = 'evaluationDate',
    } = paginationDto;
    const skip = (page - 1) * per_page;

    const where: Prisma.ProgressEvaluationWhereInput = {};

    if (search) {
      where.OR = [
        { notes: { contains: search, mode: 'insensitive' } },
        {
          player: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
        {
          student: {
            person: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const [evaluations, totalItems] = await Promise.all([
      this.prisma.progressEvaluation.findMany({
        where,
        take: per_page,
        skip,
        orderBy: { [sortField]: orderBy },
        select: progressEvaluationSelect,
      }),
      this.prisma.progressEvaluation.count({ where }),
    ]);

    return createPaginationResult(
      evaluations,
      totalItems,
      page,
      per_page,
      'Evaluaciones de progreso obtenidas exitosamente',
    );
  }

  async findOne(id: string) {
    const evaluation = await this.prisma.progressEvaluation.findUnique({
      where: { id },
      select: progressEvaluationSelect,
    });
    if (!evaluation) {
      throw new NotFoundException('La evaluación solicitada no fue encontrada');
    }
    return {
      message: 'Evaluación de progreso obtenida exitosamente',
      data: evaluation,
    };
  }

  async update(
    id: string,
    updateProgressEvaluationDto: UpdateProgressEvaluationDto,
  ) {
    const evaluation = await this.prisma.progressEvaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('La evaluación solicitada no fue encontrada');
    }

    const { playerId, studentId } = updateProgressEvaluationDto;
    const finalPlayerId =
      playerId === undefined ? evaluation.playerId : playerId;
    const finalStudentId =
      studentId === undefined ? evaluation.studentId : studentId;

    if (!finalPlayerId && !finalStudentId) {
      throw new BadRequestException(
        'Debe asociar la evaluación a un jugador o a un estudiante',
      );
    }

    const updatedEvaluation = await this.prisma.progressEvaluation.update({
      where: { id },
      data: updateProgressEvaluationDto,
      select: progressEvaluationSelect,
    });

    return {
      message: 'Evaluación de progreso actualizada exitosamente',
      data: updatedEvaluation,
    };
  }

  async remove(id: string) {
    const evaluation = await this.prisma.progressEvaluation.findUnique({
      where: { id },
    });
    if (!evaluation) {
      throw new NotFoundException('La evaluación solicitada no fue encontrada');
    }

    const deletedEvaluation = await this.prisma.progressEvaluation.delete({
      where: { id },
      select: progressEvaluationSelect,
    });

    return {
      message: 'Evaluación de progreso eliminada exitosamente',
      data: deletedEvaluation,
    };
  }
}
