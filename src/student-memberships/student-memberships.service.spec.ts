import { Test, TestingModule } from '@nestjs/testing';
import { StudentMembershipsService } from './student-memberships.service';
import { PrismaService } from 'src/prisma.service';
import { StudentChargesService } from 'src/student-charges/student-charges.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentMembershipStatus, StatusCourseSeason } from 'src/generated/prisma/client';
import * as capacityHelper from 'src/common/helpers/capacity.helper';

jest.mock('src/common/helpers/capacity.helper');

describe('StudentMembershipsService', () => {
  let service: StudentMembershipsService;
  let prismaMock: any;
  let studentChargesServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => await cb(prismaMock)),
      studentMembership: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((data) => data.data),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn(),
        create: jest.fn(),
      },
      courseSeason: {
        findUnique: jest.fn(),
      },
      courseSeasonShift: {
        findUnique: jest.fn().mockResolvedValue({ id: 'valid-shift', shift: { name: 'Destino' }, courseSeason: { id: 'valid-season', status: 'ACTIVE', courseId: 'course-1' } }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { maxMembers: 10 } }),
      },
      cycleEnrollment: {
        updateMany: jest.fn(),
      },
      studentCharge: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      student: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      person: {
        findUnique: jest.fn(),
      },
      paymentPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-id', courseSeasonId: 'season-id', active: true }),
      },
    };

    studentChargesServiceMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentMembershipsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StudentChargesService, useValue: studentChargesServiceMock },
      ],
    }).compile();

    service = module.get<StudentMembershipsService>(StudentMembershipsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const defaultCreateDto = {
      courseSeasonId: 'season-id',
      courseSeasonShiftId: 'shift-id',
      paymentPlanId: 'plan-id',
      startedAt: new Date('2026-08-01') as any, // Cast to any or just pass the date string depending on the validation, wait, the DTO says Type(() => Date) so it's a Date.
      isMigrated: false,
    };

    it('debe fallar si no se envía ni studentId ni personIdToCreateProfile (Ningún ID)', async () => {
      await expect(service.create(defaultCreateDto)).rejects.toThrow(BadRequestException);
    });

    it('debe fallar si se envían ambos IDs simultáneamente', async () => {
      await expect(service.create({ ...defaultCreateDto, studentId: 'student-id', personIdToCreateProfile: 'person-id' })).rejects.toThrow(BadRequestException);
    });

    it('debe crear un estudiante y fallar si personIdToCreateProfile falla en validación (Rollback test simulated)', async () => {
      prismaMock.courseSeason.findUnique.mockResolvedValue({ id: 'season-id', course: { billingConfig: {} }, season: { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, maxMembers: 10 });
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({ 
        id: 'shift-id', 
        courseSeasonId: 'season-id',
        gender: 'MIXED',
        shift: { gender: 'MIXED' },
        courseSeason: { 
          id: 'season-id', 
          course: { billingConfig: {} }, 
          season: { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, 
          status: 'ACTIVE' 
        }
      });
      prismaMock.person.findUnique.mockResolvedValue({ id: 'person-id' });
      prismaMock.student.findUnique.mockResolvedValue(null);
      prismaMock.student.create.mockResolvedValue({ id: 'new-student-id' });

      // Simular un fallo en capacity validation para forzar throw dentro de transaction
      prismaMock.$queryRaw = jest.fn();
      prismaMock.studentMembership.findMany.mockResolvedValue([]); // not duplicate
      prismaMock.studentMembership.create = jest.fn().mockRejectedValue(new BadRequestException('Error test rollback'));

      await expect(service.create({ ...defaultCreateDto, personIdToCreateProfile: 'person-id' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.student.create).toHaveBeenCalledWith({ data: { personId: 'person-id', isActive: true }, include: { person: true } });
    });

    it('debe continuar con studentId existente (Profile existing)', async () => {
      prismaMock.courseSeason.findUnique.mockResolvedValue({ id: 'season-id', course: { billingConfig: {} }, season: { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, maxMembers: 10 });
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({ 
        id: 'shift-id', 
        courseSeasonId: 'season-id',
        gender: 'MIXED',
        shift: { gender: 'MIXED' },
        courseSeason: { 
          id: 'season-id', 
          course: { billingConfig: {} }, 
          season: { startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, 
          status: 'ACTIVE' 
        }
      });
      prismaMock.student.findUnique.mockResolvedValue({ id: 'existing-student-id', isActive: true, person: { gender: 'MIXED' } });
      prismaMock.$queryRaw = jest.fn();
      prismaMock.studentMembership.findMany.mockResolvedValue([]);
      prismaMock.studentMembership.create = jest.fn().mockResolvedValue({ id: 'mem-1' });
      studentChargesServiceMock.generateChargesForNewMembership = jest.fn();

      await service.create({ ...defaultCreateDto, studentId: 'existing-student-id' });
      
      expect(prismaMock.student.create).not.toHaveBeenCalled();
      expect(prismaMock.studentMembership.create).toHaveBeenCalled();
    });
  });

  describe('transferShift', () => {
    const membershipId = 'membership-id';
    const targetCourseSeasonId = 'target-season-id';
    const effectiveDate = new Date('2026-08-20T00:00:00Z');

    const transferDto = {
      targetCourseSeasonId,
      targetCourseSeasonShiftId: 'target-shift-id',
      effectiveDate,
    };

    it('should successfully transfer a shift', async () => {
      // Setup
      const cycle1 = { id: 'c1', cycleStartDate: new Date('2026-08-01'), cycleEndDate: new Date('2026-08-31') }; // overlaps with effectiveDate
      const cycle2 = { id: 'c2', cycleStartDate: new Date('2026-09-01'), cycleEndDate: new Date('2026-09-30') }; // future

      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonId: 'origin-season-id',
        courseSeason: { courseId: 'course-1', shift: { name: 'Origin' } },
        cycleEnrollments: [cycle1, cycle2],
      });

      prismaMock.courseSeason.findUnique.mockResolvedValue({
        id: targetCourseSeasonId,
        status: StatusCourseSeason.ACTIVE,
        courseId: 'course-1',
        shift: { name: 'Destino' }
      });

      (capacityHelper.validateCourseSeasonCapacity as jest.Mock).mockResolvedValue(undefined);

      // Act
      await service.transferShift(membershipId, transferDto);

      // Assert
      // should update only cycle2
      expect(prismaMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c2'] } },
        data: { courseSeasonId: targetCourseSeasonId, courseSeasonShiftId: transferDto.targetCourseSeasonShiftId },
      });

      // should update membership
      expect(prismaMock.studentMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membershipId },
          data: expect.objectContaining({
            courseSeasonId: targetCourseSeasonId,
            courseSeasonShiftId: 'target-shift-id',
          })
        })
      );
    });

    it('should fail if membership is not active', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.FINISHED,
      });

      await expect(service.transferShift(membershipId, transferDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should fail if target course season belongs to different course', async () => {
      prismaMock.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: transferDto.targetCourseSeasonShiftId,
        shift: { name: 'Destino' },
        courseSeason: {
          id: targetCourseSeasonId,
          status: StatusCourseSeason.ACTIVE,
          courseId: 'different-course-id',
        },
      });

      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonId: 'origin-season-id',
        courseSeason: { courseId: 'course-1' },
        cycleEnrollments: [],
      });

      prismaMock.courseSeason.findUnique.mockResolvedValue({
        id: targetCourseSeasonId,
        status: StatusCourseSeason.ACTIVE,
        courseId: 'course-2',
      });

      await expect(service.transferShift(membershipId, transferDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll (Fase 5.3 Asistencia/Roster)', () => {
    it('should query physical attendance via CycleEnrollment if physicalDate is provided', async () => {
      const courseSeasonId = 'season-A';
      const physicalDate = '2026-08-15';
      const pDate = new Date(physicalDate);

      prismaMock.studentMembership.findMany.mockResolvedValue([]);
      prismaMock.studentMembership.count.mockResolvedValue(0);

      await service.findAll({ courseSeasonId, physicalDate });

      expect(prismaMock.studentMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cycleEnrollments: {
              some: {
                courseSeasonId,
                status: { in: ['PENDING', 'CONFIRMED'] },
                effectiveStartDate: { lte: pDate },
                cycleEndDate: { gt: pDate },
              }
            }
          })
        })
      );
    });

    it('should fallback to administrative courseSeasonId if physicalDate is not provided', async () => {
      const courseSeasonId = 'season-B';

      prismaMock.studentMembership.findMany.mockResolvedValue([]);
      prismaMock.studentMembership.count.mockResolvedValue(0);

      await service.findAll({ courseSeasonId });

      expect(prismaMock.studentMembership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            courseSeasonId
          })
        })
      );
    });
  });
});
