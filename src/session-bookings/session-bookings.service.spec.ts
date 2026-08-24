import { Test, TestingModule } from '@nestjs/testing';
import { SessionBookingsService } from './session-bookings.service';
import { PrismaService } from 'src/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StudentMembershipStatus, CycleEnrollmentStatus } from 'src/generated/prisma/client';
import { CreateSessionBookingDto } from './dto/create-session-booking.dto';

describe('SessionBookingsService', () => {
  let service: SessionBookingsService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      session: { findUniqueOrThrow: jest.fn() },
      studentMembership: { findFirst: jest.fn() },
      cycleEnrollment: { findFirst: jest.fn() },
      sessionBooking: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionBookingsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<SessionBookingsService>(SessionBookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('SessionBookingsService (CourseSeason Authorization)', () => {
    const sessionId = 'session-1';
    const studentId = 'student-1';
    const courseSeasonId = 'course-season-1';
    const sessionStart = new Date('2026-08-15T10:00:00Z');

    let baseSessionMock: any;
    let baseMembershipMock: any;
    let baseCycleEnrollmentMock: any;

    beforeEach(() => {
      baseSessionMock = {
        id: sessionId,
        event: { startDate: sessionStart },
        sessionCourses: [
          { courseSeasonShift: { courseSeasonId } },
        ],
      };

      baseMembershipMock = {
        id: 'membership-1',
        studentId,
        courseSeasonId,
        status: StudentMembershipStatus.ACTIVE,
      };

      baseCycleEnrollmentMock = {
        id: 'cycle-1',
        studentMembershipId: 'membership-1',
        status: CycleEnrollmentStatus.CONFIRMED,
        cycleStartDate: new Date('2026-08-01T00:00:00Z'),
        cycleEndDate: new Date('2026-09-01T00:00:00Z'),
      };

      prismaService.session.findUniqueOrThrow.mockResolvedValue(baseSessionMock);
      prismaService.studentMembership.findFirst.mockResolvedValue(baseMembershipMock);
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(baseCycleEnrollmentMock);
      prismaService.sessionBooking.create.mockResolvedValue({ id: 'booking-1' });
    });

    it('Permitido: ACTIVE + CONFIRMED + sessionStart dentro del ciclo', async () => {
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(prismaService.sessionBooking.create).toHaveBeenCalled();
    });

    it('Rechazado: ACTIVE + GAP (sin CycleEnrollment)', async () => {
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.create(dto)).rejects.toThrow('El estudiante no tiene un ciclo confirmado vigente para esta sesión.');
    });

    it('Rechazado: ACTIVE + ciclo futuro', async () => {
      // simulate findFirst returning null because the cycle is in the future relative to the session
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: ACTIVE + ciclo expirado', async () => {
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: ACTIVE + CANCELLED', async () => {
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: ACTIVE + PENDING', async () => {
      prismaService.cycleEnrollment.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: SUSPENDED + CONFIRMED', async () => {
      prismaService.studentMembership.findFirst.mockResolvedValue({
        ...baseMembershipMock,
        status: StudentMembershipStatus.SUSPENDED,
      });
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.create(dto)).rejects.toThrow('El estudiante se encuentra suspendido o inactivo.');
    });

    it('Rechazado: WITHDRAWN + CONFIRMED', async () => {
      prismaService.studentMembership.findFirst.mockResolvedValue({
        ...baseMembershipMock,
        status: StudentMembershipStatus.WITHDRAWN,
      });
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: FINISHED + CONFIRMED', async () => {
      prismaService.studentMembership.findFirst.mockResolvedValue({
        ...baseMembershipMock,
        status: StudentMembershipStatus.FINISHED,
      });
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
    });

    it('Rechazado: sin membership', async () => {
      prismaService.studentMembership.findFirst.mockResolvedValue(null);
      const dto: CreateSessionBookingDto = { sessionId, studentId };
      await expect(service.create(dto)).rejects.toThrow(ForbiddenException);
      await expect(service.create(dto)).rejects.toThrow('El estudiante no tiene una membresía activa para este curso.');
    });

    it('Contrato DTO: playerId + studentId → rechazar', async () => {
      const dto: CreateSessionBookingDto = { sessionId, studentId, playerId: 'player-1' };
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('Contrato DTO: ninguno → rechazar', async () => {
      const dto = { sessionId } as CreateSessionBookingDto;
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('Aislamiento: TeamSeason (playerId) → válido', async () => {
      prismaService.session.findUniqueOrThrow.mockResolvedValue({
        id: sessionId,
        event: { startDate: sessionStart },
        sessionCourses: [], // No es CourseSeason
      });
      const dto: CreateSessionBookingDto = { sessionId, playerId: 'player-1' };
      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(prismaService.studentMembership.findFirst).not.toHaveBeenCalled();
      expect(prismaService.sessionBooking.create).toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('debe rechazar/cortar la posibilidad de modificar studentId, playerId y sessionId', async () => {
      prismaService.sessionBooking.findUnique.mockResolvedValue({ id: 'booking-1' });
      prismaService.sessionBooking.update.mockResolvedValue({ id: 'booking-1' });

      // Simular que el cliente intenta enviar campos prohibidos aunque el DTO (en TS) no los exponga
      const dto = {
        isExternal: true,
        studentId: 'hacked-student-id',
        playerId: 'hacked-player-id',
        sessionId: 'hacked-session-id',
      } as any;

      await service.update('booking-1', dto);

      expect(prismaService.sessionBooking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: {
          isExternal: true,
          attended: undefined,
          chargeId: undefined,
        },
        select: expect.any(Object),
      });
    });

    it('debe continuar permitiendo actualizar un campo legítimamente editable', async () => {
      prismaService.sessionBooking.findUnique.mockResolvedValue({ id: 'booking-1' });
      prismaService.sessionBooking.update.mockResolvedValue({ id: 'booking-1' });

      const dto = { attended: true } as any;

      await service.update('booking-1', dto);

      expect(prismaService.sessionBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attended: true }),
        }),
      );
    });
  });

  describe('findAll()', () => {
    it('debe filtrar por sessionId cuando se provee', async () => {
      prismaService.sessionBooking.findMany.mockResolvedValue([]);
      prismaService.sessionBooking.count.mockResolvedValue(0);

      await service.findAll({ sessionId: 'test-session-id' });

      expect(prismaService.sessionBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sessionId: 'test-session-id' }),
        })
      );
    });

    it('debe mantener el comportamiento anterior si no hay sessionId', async () => {
      prismaService.sessionBooking.findMany.mockResolvedValue([]);
      prismaService.sessionBooking.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prismaService.sessionBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });
});
