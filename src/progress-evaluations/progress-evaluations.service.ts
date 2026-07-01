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
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      name: true,
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
    const { playerId, studentId } = createProgressEvaluationDto;

    if (!playerId && !studentId) {
      throw new BadRequestException(
        'Debe asociar la evaluación a un jugador o a un estudiante',
      );
    }

    const newEvaluation = await this.prisma.progressEvaluation.create({
      data: createProgressEvaluationDto,
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
