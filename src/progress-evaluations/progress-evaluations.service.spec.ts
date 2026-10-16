import { Test, TestingModule } from '@nestjs/testing';
import { ProgressEvaluationsService } from './progress-evaluations.service';
import { PrismaService } from 'src/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProgressEvaluationsService (Generic Canonical Architecture)', () => {
  let service: ProgressEvaluationsService;

  const mockPrisma = {
    progressEvaluation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    student: { findUnique: jest.fn() },
    player: { findUnique: jest.fn() },
    courseSeasonShift: { findUnique: jest.fn() },
    teamSeasonCategory: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
    studentMembership: { findFirst: jest.fn() },
    playerMembership: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressEvaluationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProgressEvaluationsService>(
      ProgressEvaluationsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create - Canonical Validations & Derivations', () => {
    it('should reject if both studentId and playerId are provided', async () => {
      await expect(
        service.create({
          studentId: 'student-1',
          playerId: 'player-1',
          courseSeasonShiftId: 'shift-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Una evaluación no puede asociarse simultáneamente a un estudiante y a un jugador',
        ),
      );
    });

    it('should reject if neither studentId nor playerId is provided', async () => {
      await expect(
        service.create({
          courseSeasonShiftId: 'shift-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Debe asociar la evaluación a un jugador o a un estudiante',
        ),
      );
    });

    it('should reject COURSE evaluation with missing courseSeasonShiftId', async () => {
      await expect(
        service.create({
          studentId: 'student-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Debe especificar el turno escolar (courseSeasonShiftId) para evaluar a un estudiante',
        ),
      );
    });

    it('should reject TEAM evaluation with missing teamSeasonCategoryId', async () => {
      await expect(
        service.create({
          playerId: 'player-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Debe especificar la categoría de equipo (teamSeasonCategoryId) para evaluar a un jugador',
        ),
      );
    });

    it('should reject cross-type mismatch: Student with TeamSeasonCategory', async () => {
      await expect(
        service.create({
          studentId: 'student-1',
          teamSeasonCategoryId: 'cat-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Un estudiante no puede asociarse a una categoría de equipo',
        ),
      );
    });

    it('should derive seasonId from CourseSeasonShift and create successfully', async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: 'student-1' });
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ id: 'staff-1' });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: 'shift-1',
        courseSeason: { seasonId: 'season-course-2026' },
      });
      mockPrisma.studentMembership.findFirst.mockResolvedValueOnce({ id: 'mem-1' });

      mockPrisma.progressEvaluation.create.mockResolvedValueOnce({
        id: 'eval-created-1',
        studentId: 'student-1',
        courseSeasonShiftId: 'shift-1',
        seasonId: 'season-course-2026',
        evaluatorStaffId: 'staff-1',
      });

      const res = await service.create({
        studentId: 'student-1',
        courseSeasonShiftId: 'shift-1',
        evaluatorStaffId: 'staff-1',
        evaluationDate: new Date('2026-06-01'),
        technicalScore: 85,
      });

      expect(mockPrisma.progressEvaluation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student-1',
            courseSeasonShiftId: 'shift-1',
            seasonId: 'season-course-2026',
            evaluatorStaffId: 'staff-1',
            technicalScore: 85,
          }),
        }),
      );
      expect(res.data.id).toBe('eval-created-1');
    });

    it('should derive seasonId from TeamSeasonCategory and create successfully', async () => {
      mockPrisma.player.findUnique.mockResolvedValueOnce({ id: 'player-1' });
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ id: 'staff-1' });
      mockPrisma.teamSeasonCategory.findUnique.mockResolvedValueOnce({
        id: 'cat-u15',
        teamSeason: { seasonId: 'season-team-2026' },
      });
      mockPrisma.playerMembership.findFirst.mockResolvedValueOnce({ id: 'pm-1' });

      mockPrisma.progressEvaluation.create.mockResolvedValueOnce({
        id: 'eval-created-2',
        playerId: 'player-1',
        teamSeasonCategoryId: 'cat-u15',
        seasonId: 'season-team-2026',
        evaluatorStaffId: 'staff-1',
      });

      const res = await service.create({
        playerId: 'player-1',
        teamSeasonCategoryId: 'cat-u15',
        evaluatorStaffId: 'staff-1',
        evaluationDate: new Date('2026-06-01'),
      });

      expect(mockPrisma.progressEvaluation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            playerId: 'player-1',
            teamSeasonCategoryId: 'cat-u15',
            seasonId: 'season-team-2026',
            evaluatorStaffId: 'staff-1',
          }),
        }),
      );
      expect(res.data.id).toBe('eval-created-2');
    });

    it('should reject foreign participant in Course shift', async () => {
      mockPrisma.student.findUnique.mockResolvedValueOnce({ id: 'student-1' });
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ id: 'staff-1' });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: 'shift-1',
        courseSeason: { seasonId: 'season-2026' },
      });
      mockPrisma.studentMembership.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.create({
          studentId: 'student-1',
          courseSeasonShiftId: 'shift-1',
          evaluatorStaffId: 'staff-1',
          evaluationDate: new Date(),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'El estudiante no posee una matrícula válida en el turno escolar especificado',
        ),
      );
    });
  });

  describe('findAll, findOne, update, remove - Generic Regression', () => {
    it('findAll should return paginated evaluations', async () => {
      mockPrisma.progressEvaluation.findMany.mockResolvedValueOnce([
        { id: 'e1' },
      ]);
      mockPrisma.progressEvaluation.count.mockResolvedValueOnce(1);

      const res = await service.findAll({ per_page: 10, page: 1 });
      expect(res.data).toHaveLength(1);
      expect(res.meta.totalItems).toBe(1);
    });

    it('findOne should return evaluation if exists', async () => {
      mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce({
        id: 'e1',
      });

      const res = await service.findOne('e1');
      expect(res.data.id).toBe('e1');
    });

    it('findOne should throw NotFoundException if not exists', async () => {
      mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('remove should delete successfully', async () => {
      mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce({
        id: 'e1',
      });
      mockPrisma.progressEvaluation.delete.mockResolvedValueOnce({
        id: 'e1',
      });

      const res = await service.remove('e1');
      expect(res.data.id).toBe('e1');
    });
  });
});
