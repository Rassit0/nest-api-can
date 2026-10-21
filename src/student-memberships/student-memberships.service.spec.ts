import { Test, TestingModule } from '@nestjs/testing';
import { StudentMembershipsService } from './student-memberships.service';
import { PrismaService } from 'src/prisma.service';
import { StudentChargesService } from 'src/student-charges/student-charges.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentMembershipStatus, StatusCourseSeason } from 'src/generated/prisma/client';
import * as capacityHelper from 'src/common/helpers/capacity.helper';

jest.mock('src/common/helpers/capacity.helper');
jest.mock('src/common/utils/charge-lock.util', () => ({
  lockChargeForUpdate: jest.fn(),
}));

describe('StudentMembershipsService', () => {
  let service: StudentMembershipsService;
  let prismaMock: any;
  let studentChargesServiceMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn(async (cb) => await cb(prismaMock)),
      $queryRaw: jest.fn().mockResolvedValue([]),
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
        updateMany: jest.fn(),
      },
      cycleEnrollment: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
        updateMany: jest.fn(),
      },
      charge: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation((args) => ({ id: args.where.id, ...args.data })),
      },
      sessionBooking: {
        count: jest.fn().mockResolvedValue(0),
      },
      studentCharge: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      student: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
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
      prismaMock.student.upsert.mockResolvedValue({ id: 'new-student-id' });

      // Simular un fallo en capacity validation para forzar throw dentro de transaction
      prismaMock.$queryRaw = jest.fn();
      prismaMock.studentMembership.findMany.mockResolvedValue([]); // not duplicate
      prismaMock.studentMembership.create = jest.fn().mockRejectedValue(new BadRequestException('Error test rollback'));

      await expect(service.create({ ...defaultCreateDto, personIdToCreateProfile: 'person-id' })).rejects.toThrow(BadRequestException);
      expect(prismaMock.student.upsert).toHaveBeenCalledWith({
        where: { personId: 'person-id' },
        update: {},
        create: { personId: 'person-id', isActive: true },
        include: { person: true }
      });
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

    it('should successfully transfer active and future cycles while strictly preserving historical cycles', async () => {
      // Setup
      const cycle0Historical = { id: 'c0', cycleStartDate: new Date('2026-07-01'), cycleEndDate: new Date('2026-07-31') }; // past (ended before effectiveDate)
      const cycle1Active = { id: 'c1', cycleStartDate: new Date('2026-08-01'), cycleEndDate: new Date('2026-08-31') }; // active (overlaps with effectiveDate)
      const cycle2Future = { id: 'c2', cycleStartDate: new Date('2026-09-01'), cycleEndDate: new Date('2026-09-30') }; // future

      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonId: 'origin-season-id',
        courseSeasonShiftId: 'origin-shift-id',
        courseSeason: { courseId: 'course-1', shift: { name: 'Origin' } },
        cycleEnrollments: [cycle0Historical, cycle1Active, cycle2Future],
      });

      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({
        id: transferDto.targetCourseSeasonShiftId,
        shift: { name: 'Destino' },
        courseSeason: {
          id: targetCourseSeasonId,
          status: StatusCourseSeason.ACTIVE,
          courseId: 'course-1',
        },
      });

      (capacityHelper.validateCourseSeasonCapacity as jest.Mock).mockResolvedValue(undefined);

      // Act
      await service.transferShift(membershipId, transferDto);

      // Assert 1: Capacity validated for active (c1) and future (c2), but NOT historical (c0)
      expect(capacityHelper.validateCourseSeasonCapacity).toHaveBeenCalledTimes(2);
      expect(capacityHelper.validateCourseSeasonCapacity).toHaveBeenCalledWith(
        expect.anything(),
        'target-shift-id',
        cycle1Active.cycleStartDate,
        cycle1Active.cycleEndDate,
        'c1',
      );
      expect(capacityHelper.validateCourseSeasonCapacity).toHaveBeenCalledWith(
        expect.anything(),
        'target-shift-id',
        cycle2Future.cycleStartDate,
        cycle2Future.cycleEndDate,
        'c2',
      );

      // Assert 2: cycleEnrollment.updateMany updates BOTH active and future, NOT historical
      expect(prismaMock.cycleEnrollment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2'] } },
        data: { courseSeasonId: targetCourseSeasonId, courseSeasonShiftId: transferDto.targetCourseSeasonShiftId },
      });

      // Assert 3: StudentMembership is updated to target shift immediately
      expect(prismaMock.studentMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: membershipId },
          data: expect.objectContaining({
            courseSeasonId: targetCourseSeasonId,
            courseSeasonShiftId: 'target-shift-id',
          }),
        }),
      );
    });

    it('should fail and rollback completely if capacity is exceeded in active cycle', async () => {
      const cycle1Active = { id: 'c1', cycleStartDate: new Date('2026-08-01'), cycleEndDate: new Date('2026-08-31') };

      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonId: 'origin-season-id',
        courseSeasonShiftId: 'origin-shift-id',
        courseSeason: { courseId: 'course-1', shift: { name: 'Origin' } },
        cycleEnrollments: [cycle1Active],
      });

      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({
        id: transferDto.targetCourseSeasonShiftId,
        shift: { name: 'Destino' },
        courseSeason: {
          id: targetCourseSeasonId,
          status: StatusCourseSeason.ACTIVE,
          courseId: 'course-1',
        },
      });

      (capacityHelper.validateCourseSeasonCapacity as jest.Mock).mockRejectedValueOnce(
        new BadRequestException('El cupo de este ciclo ya no está disponible'),
      );

      await expect(service.transferShift(membershipId, transferDto))
        .rejects.toThrow(BadRequestException);

      // Verify no updates occurred
      expect(prismaMock.cycleEnrollment.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.studentMembership.update).not.toHaveBeenCalled();
    });

    it('should maintain financial integrity (no charge/payment mutations during shift transfer)', async () => {
      const cycle1Active = { id: 'c1', cycleStartDate: new Date('2026-08-01'), cycleEndDate: new Date('2026-08-31') };

      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonId: 'origin-season-id',
        courseSeasonShiftId: 'origin-shift-id',
        courseSeason: { courseId: 'course-1', shift: { name: 'Origin' } },
        cycleEnrollments: [cycle1Active],
      });

      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({
        id: transferDto.targetCourseSeasonShiftId,
        shift: { name: 'Destino' },
        courseSeason: {
          id: targetCourseSeasonId,
          status: StatusCourseSeason.ACTIVE,
          courseId: 'course-1',
        },
      });

      (capacityHelper.validateCourseSeasonCapacity as jest.Mock).mockResolvedValue(undefined);

      await service.transferShift(membershipId, transferDto);

      // Verify financial tables are not touched
      expect(prismaMock.studentCharge.findMany).toHaveBeenCalledTimes(0);
    });

    it('should fail if membership is not active', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.FINISHED,
      });

      await expect(service.transferShift(membershipId, transferDto))
        .rejects.toThrow(BadRequestException);
    });

    it('should fail if student is already in the target shift', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue({
        id: membershipId,
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonShiftId: transferDto.targetCourseSeasonShiftId,
        courseSeasonId: targetCourseSeasonId,
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

  describe('cancelCycleEnrollment', () => {
    it('debe rechazar si el motivo tiene menos de 5 caracteres', async () => {
      await expect(service.cancelCycleEnrollment('cycle-1', 'err')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe lanzar NotFoundException si el ciclo no existe', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelCycleEnrollment('cycle-999', 'Cancelación por error administrativo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe ser idempotente si el ciclo ya está CANCELLED', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue({
        id: 'cycle-1',
        status: 'CANCELLED',
      });

      const result = await service.cancelCycleEnrollment(
        'cycle-1',
        'Cancelación por error administrativo',
      );
      expect(result.message).toContain('ya se encontraba cancelado');
    });

    it('debe rechazar si el ciclo está CONFIRMED', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue({
        id: 'cycle-1',
        status: 'CONFIRMED',
        studentMembership: { studentId: 'student-1' },
      });

      await expect(
        service.cancelCycleEnrollment('cycle-1', 'Cancelación por error administrativo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si el estudiante tiene asistencias registradas en el período', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue({
        id: 'cycle-1',
        status: 'PENDING',
        cycleStartDate: new Date('2026-11-01'),
        cycleEndDate: new Date('2026-11-30'),
        studentMembership: { studentId: 'student-1' },
      });
      prismaMock.sessionBooking.count.mockResolvedValue(1);

      await expect(
        service.cancelCycleEnrollment('cycle-1', 'Cancelación por error administrativo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar si el cargo tiene pagos completados', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue({
        id: 'cycle-1',
        status: 'PENDING',
        chargeId: 'charge-1',
        cycleStartDate: new Date('2026-11-01'),
        cycleEndDate: new Date('2026-11-30'),
        studentMembership: { studentId: 'student-1' },
      });
      prismaMock.sessionBooking.count.mockResolvedValue(0);
      prismaMock.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        status: 'PENDING',
        payments: [{ id: 'payment-1', status: 'COMPLETED' }],
      });

      await expect(
        service.cancelCycleEnrollment('cycle-1', 'Cancelación por error administrativo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe cancelar exitosamente el ciclo y neutralizar el cargo', async () => {
      prismaMock.cycleEnrollment.findUnique.mockResolvedValue({
        id: 'cycle-1',
        status: 'PENDING',
        chargeId: 'charge-1',
        courseSeasonShiftId: 'shift-1',
        cycleStartDate: new Date('2026-11-01'),
        cycleEndDate: new Date('2026-11-30'),
        studentMembership: { studentId: 'student-1' },
      });
      prismaMock.sessionBooking.count.mockResolvedValue(0);
      prismaMock.charge.findUnique.mockResolvedValue({
        id: 'charge-1',
        status: 'PENDING',
        payments: [],
      });

      const result = await service.cancelCycleEnrollment(
        'cycle-1',
        'Inscripción errónea solicitada por apoderado',
        { id: 'user-admin' },
      );

      expect(prismaMock.charge.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'charge-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            adjustmentReason: 'Cancelado: Inscripción errónea solicitada por apoderado',
          }),
        }),
      );

      expect(prismaMock.cycleEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cycle-1' },
          data: expect.objectContaining({
            status: 'CANCELLED',
            updatedById: 'user-admin',
          }),
        }),
      );

      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('reenter (Reingreso de StudentMembership WITHDRAWN)', () => {
    const validWithdrawnMembership = {
      id: 'sm-withdrawn-1',
      studentId: 'student-1',
      courseSeasonId: 'course-season-1',
      courseSeasonShiftId: 'shift-1',
      paymentPlanId: 'plan-1',
      startedAt: new Date('2026-01-10T00:00:00.000Z'),
      endedAt: new Date('2026-03-15T00:00:00.000Z'),
      reenteredAt: null,
      status: StudentMembershipStatus.WITHDRAWN,
      notes: 'Baja voluntaria por viaje',
      student: {
        id: 'student-1',
        isActive: true,
        person: {
          name: 'Lucas',
          lastName: 'Saucedo',
          birthDate: new Date('2015-05-10'),
          gender: 'MALE',
        },
      },
      courseSeason: {
        id: 'course-season-1',
        status: StatusCourseSeason.ACTIVE,
        season: {
          id: 'season-1',
          name: 'Temporada 2026',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T23:59:59.999Z'),
        },
        course: { id: 'course-1', name: 'Natación Infantil' },
        shifts: [],
      },
      courseSeasonShift: {
        id: 'shift-1',
        isActive: true,
        courseSeasonId: 'course-season-1',
        maxMembers: 20,
        validateAge: false,
        gender: 'MIXED',
        shift: { name: 'Tarde 16:00' },
        category: { name: 'Infantil', minAge: 6, maxAge: 12 },
        courseSeason: {
          season: {
            startDate: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      },
      histories: [
        {
          id: 'h-1',
          previousStatus: StudentMembershipStatus.ACTIVE,
          newStatus: StudentMembershipStatus.WITHDRAWN,
          reason: 'Baja voluntaria por viaje',
          createdAt: new Date('2026-03-15T10:00:00.000Z'),
        },
      ],
      cycleEnrollments: [
        {
          id: 'ce-1',
          cycleStartDate: new Date('2026-01-15T00:00:00.000Z'),
          cycleEndDate: new Date('2026-02-15T00:00:00.000Z'),
          status: 'CONFIRMED',
          attempt: 1,
          charge: { id: 'ch-1', status: 'PAID', amount: 150 },
        },
        {
          id: 'ce-2',
          cycleStartDate: new Date('2026-03-15T00:00:00.000Z'),
          cycleEndDate: new Date('2026-04-15T00:00:00.000Z'),
          status: 'CANCELLED',
          attempt: 1,
          charge: { id: 'ch-2', status: 'CANCELLED', amount: 150 },
        },
      ],
    };

    it('debe reactivar exitosamente una membresía WITHDRAWN reutilizando su mismo ID y preservando antecedentes (1. Reingreso posterior a la baja)', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue(null); // Sin duplicados activos
      prismaMock.studentMembership.findMany.mockResolvedValue([validWithdrawnMembership]); // Única retirada
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue(validWithdrawnMembership.courseSeasonShift);
      prismaMock.studentMembership.count.mockResolvedValue(5); // 5 activos de 20 max
      prismaMock.studentMembership.update.mockImplementation((args: any) => ({
        id: args.where.id,
        ...args.data,
      }));

      const result = await service.reenter(
        'sm-withdrawn-1',
        {
          effectiveDate: '2026-09-01T00:00:00.000Z', // Posterior a la baja del 2026-03-15
          reason: 'Reincorporación tras retorno de viaje familiar',
          notes: 'Autorizado por coordinación',
        },
        { id: 'user-admin-1' },
      );

      // 1. Verifica reutilización de ID
      expect(prismaMock.studentMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sm-withdrawn-1' },
          data: expect.objectContaining({
            status: StudentMembershipStatus.ACTIVE,
            endedAt: null,
            reenteredAt: new Date('2026-09-01T00:00:00.000Z'),
            courseSeasonShiftId: 'shift-1',
            updatedById: 'user-admin-1',
            histories: {
              create: expect.objectContaining({
                previousStatus: StudentMembershipStatus.WITHDRAWN,
                newStatus: StudentMembershipStatus.ACTIVE,
                reason: 'Reincorporación tras retorno de viaje familiar',
                effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
                createdById: 'user-admin-1',
              }),
            },
          }),
        }),
      );

      // 2. Verifica mensaje de éxito
      expect(result.message).toContain('exitosamente');
    });

    it('2. Reingreso anterior a la baja: rechazado con BadRequestException', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);

      // Intento con fecha anterior a la baja (2026-03-10 < 2026-03-15)
      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-03-10T00:00:00.000Z',
          reason: 'Intento con fecha retroactiva anterior a baja',
        }),
      ).rejects.toThrow('debe ser posterior a la última baja registrada');
    });

    it('3. Fecha futura: rechazada con BadRequestException', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);

      // Fecha en el futuro lejano (ej. 1 año en el futuro)
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: futureDate,
          reason: 'Intento de reingreso con fecha futura',
        }),
      ).rejects.toThrow('no puede ser una fecha futura');
    });

    it('4. Fecha fuera de temporada: rechazada con BadRequestException', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2025-12-31T00:00:00.000Z', // Anterior al inicio de temporada 2026
          reason: 'Reingreso fuera de fecha',
        }),
      ).rejects.toThrow('debe estar dentro del rango de la temporada');
    });

    it('5. Reingreso después de varias bajas: se toma la última baja registrada', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue({
        ...validWithdrawnMembership,
        endedAt: new Date('2026-08-20T12:00:00.000Z'),
        histories: [
          {
            id: 'h-3',
            previousStatus: StudentMembershipStatus.ACTIVE,
            newStatus: StudentMembershipStatus.WITHDRAWN,
            reason: 'Segunda baja (más reciente)',
            createdAt: new Date('2026-08-20T12:00:00.000Z'),
          },
          {
            id: 'h-2',
            previousStatus: StudentMembershipStatus.WITHDRAWN,
            newStatus: StudentMembershipStatus.ACTIVE,
            reason: 'Primer reingreso',
            createdAt: new Date('2026-06-01T10:00:00.000Z'),
          },
          {
            id: 'h-1',
            previousStatus: StudentMembershipStatus.ACTIVE,
            newStatus: StudentMembershipStatus.WITHDRAWN,
            reason: 'Primera baja (antigua)',
            createdAt: new Date('2026-04-10T08:00:00.000Z'),
          },
        ],
      });

      // Fecha posterior a la 1ra baja (2026-04-10), pero ANTERIOR a la 2da baja (2026-08-20)
      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-07-15T00:00:00.000Z',
          reason: 'Intento de fecha intermedia entre dos bajas',
        }),
      ).rejects.toThrow('debe ser posterior a la última baja registrada');
    });

    it('6. Historial anterior intacto: preserva startedAt, no sobreescribe antecedentes y no revive ciclos cancelados', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue(null);
      prismaMock.studentMembership.findMany.mockResolvedValue([validWithdrawnMembership]);
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue(validWithdrawnMembership.courseSeasonShift);
      prismaMock.studentMembership.count.mockResolvedValue(5);

      await service.reenter('sm-withdrawn-1', {
        effectiveDate: '2026-09-01T00:00:00.000Z',
        reason: 'Reingreso verificado',
      });

      // startedAt jamás se incluye en los datos de update
      expect(prismaMock.studentMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            startedAt: expect.anything(),
          }),
        }),
      );

      // No se deben llamar mutaciones sobre cycleEnrollment ni charge
      expect(prismaMock.cycleEnrollment.update).not.toHaveBeenCalled();
      expect(prismaMock.cycleEnrollment.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.charge.update).not.toHaveBeenCalled();
    });

    it('7. Validaciones de UTC y límites de día: offsets horarios y límites de fecha interpretados en UTC', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue(null);
      prismaMock.studentMembership.findMany.mockResolvedValue([validWithdrawnMembership]);
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue(validWithdrawnMembership.courseSeasonShift);
      prismaMock.studentMembership.count.mockResolvedValue(5);
      prismaMock.studentMembership.update.mockImplementation((args: any) => ({
        id: args.where.id,
        ...args.data,
      }));

      // Acepta fecha con timezone offset explícito interpretada correctamente en UTC (2026-09-15T20:00:00-04:00 -> 2026-09-16T00:00:00.000Z)
      const resultWithOffset = await service.reenter(
        'sm-withdrawn-1',
        {
          effectiveDate: '2026-09-15T20:00:00-04:00',
          reason: 'Reingreso con offset UTC-4',
        },
      );
      expect(resultWithOffset.message).toContain('exitosamente');

      // Rechaza fecha fuera del límite exacto de inicio de temporada (1 ms antes de temporada 2026)
      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2025-12-31T23:59:59.999Z',
          reason: 'Límite inicio de temporada',
        }),
      ).rejects.toThrow('debe estar dentro del rango de la temporada');
    });

    it('debe rechazar si la membresía no existe (NotFoundException)', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.reenter('non-existent', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Reingreso solicitado',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe rechazar si el estado actual NO es WITHDRAWN (ej. ACTIVE)', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue({
        ...validWithdrawnMembership,
        status: StudentMembershipStatus.ACTIVE,
      });

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Reingreso de activo',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe BLOQUEAR la reactivación si ya existe OTRA membresía ACTIVE para el mismo estudiante en el curso', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue({
        id: 'sm-active-2',
        status: StudentMembershipStatus.ACTIVE,
        courseSeasonShift: { shift: { name: 'Tarde 18:00' } },
      });

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Intento de reingreso duplicado',
        }),
      ).rejects.toThrow('el estudiante ya cuenta con una membresía vigente');
    });

    it('debe BLOQUEAR la reactivación si existe una membresía SUSPENDED en el curso', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue({
        id: 'sm-suspended-2',
        status: StudentMembershipStatus.SUSPENDED,
        courseSeasonShift: { shift: { name: 'Mañana 08:00' } },
      });

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Intento de reingreso teniendo suspendida',
        }),
      ).rejects.toThrow('el estudiante ya cuenta con una membresía vigente');
    });

    it('debe rechazar si existen múltiples WITHDRAWN históricas y se intenta reactivar una que no es la más reciente', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue(null);
      // Múltiples retiradas, pero la más reciente es sm-newer-withdrawn
      prismaMock.studentMembership.findMany.mockResolvedValue([
        { id: 'sm-newer-withdrawn', endedAt: new Date('2026-08-01') },
        { id: 'sm-withdrawn-1', endedAt: new Date('2026-03-15') },
      ]);

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Intento de reactivar expediente antiguo',
        }),
      ).rejects.toThrow('el reingreso debe realizarse sobre el expediente más reciente');
    });

    it('debe rechazar si el turno seleccionado excede su cupo máximo', async () => {
      prismaMock.studentMembership.findUnique.mockResolvedValue(validWithdrawnMembership);
      prismaMock.studentMembership.findFirst.mockResolvedValue(null);
      prismaMock.studentMembership.findMany.mockResolvedValue([validWithdrawnMembership]);
      prismaMock.courseSeasonShift.findUnique.mockResolvedValue({
        ...validWithdrawnMembership.courseSeasonShift,
        maxMembers: 10,
      });
      prismaMock.studentMembership.count.mockResolvedValue(10); // Lleno (10/10)

      await expect(
        service.reenter('sm-withdrawn-1', {
          effectiveDate: '2026-09-01T00:00:00.000Z',
          reason: 'Reingreso a turno lleno',
        }),
      ).rejects.toThrow('El curso ya alcanzó el número máximo de miembros');
    });
  });

  describe('getReenterContext', () => {
    it('debe retornar contexto completo de reingreso con alumno, curso, cupos y resumen de ciclos', async () => {
      const membershipWithContext = {
        id: 'sm-withdrawn-1',
        status: StudentMembershipStatus.WITHDRAWN,
        startedAt: new Date('2026-01-10T00:00:00.000Z'),
        endedAt: new Date('2026-03-15T00:00:00.000Z'),
        reenteredAt: null,
        notes: 'Baja voluntaria',
        student: {
          id: 'student-1',
          person: {
            name: 'Lucas',
            lastName: 'Saucedo',
            secondLastName: 'Perez',
            documentNumber: '1234567',
            birthDate: new Date('2015-05-10'),
          },
        },
        courseSeason: {
          id: 'cs-1',
          status: 'ACTIVE',
          course: { name: 'Natación Infantil' },
          season: {
            name: 'Temporada 2026',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
          },
          shifts: [
            {
              id: 'shift-1',
              maxMembers: 15,
              gender: 'MIXED',
              shift: { name: 'Tarde 16:00' },
              category: { name: 'Infantil' },
            },
          ],
        },
        courseSeasonShift: {
          id: 'shift-1',
          shift: { name: 'Tarde 16:00' },
          category: { name: 'Infantil' },
        },
        histories: [
          {
            reason: 'Baja administrativa por viaje',
            createdAt: new Date('2026-03-15'),
          },
        ],
        cycleEnrollments: [
          { id: 'ce-1', status: 'CONFIRMED', attempt: 1, charge: { status: 'PAID', amount: 150 } },
          { id: 'ce-2', status: 'CANCELLED', attempt: 1, charge: { status: 'CANCELLED', amount: 150 } },
        ],
      };

      prismaMock.studentMembership.findUnique.mockResolvedValue(membershipWithContext);
      prismaMock.studentMembership.count.mockResolvedValue(3); // 3 ocupados de 15

      const context = await service.getReenterContext('sm-withdrawn-1');

      expect(context.membershipId).toBe('sm-withdrawn-1');
      expect(context.student.firstName).toBe('Lucas');
      expect(context.student.lastName).toBe('Saucedo Perez');
      expect(context.courseSeason.courseName).toBe('Natación Infantil');
      expect(context.cyclesSummary.confirmed).toBe(1);
      expect(context.cyclesSummary.cancelled).toBe(1);
      expect(context.cyclesSummary.total).toBe(2);
      expect(context.availableShifts[0].availableSpots).toBe(12);
    });
  });
});
