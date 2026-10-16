import { Test, TestingModule } from '@nestjs/testing';
import { StaffAccessService } from './staff-access.service';
import { PrismaService } from 'src/prisma.service';
import { SessionsService } from 'src/sessions/sessions.service';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

describe('StaffAccessService (Phase A Targeted Unit Tests)', () => {
  let service: StaffAccessService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
    courseSeasonStaff: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    teamSeasonStaff: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    courseSeasonShift: { findUnique: jest.fn() },
    teamSeasonCategory: { findUnique: jest.fn() },
    studentMembership: { groupBy: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    cycleEnrollment: { groupBy: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    playerMembership: { groupBy: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    session: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    sessionCourse: { findFirst: jest.fn(), findUnique: jest.fn() },
    sessionTeam: { findFirst: jest.fn(), findUnique: jest.fn() },
    sessionBooking: { findMany: jest.fn(), upsert: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    progressEvaluation: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    sessionIncident: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    location: { findMany: jest.fn() },
    event: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockSessionsService = {
    create: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStaff = {
    id: 'staff-1',
    isActive: true,
    person: {
      id: 'person-1',
      name: 'Roberto',
      lastName: 'Gomez',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffAccessService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionsService, useValue: mockSessionsService },
      ],
    }).compile();

    service = module.get<StaffAccessService>(StaffAccessService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Identity Resolution (User -> Person -> Staff)', () => {
    it('should throw UnauthorizedException if user context is missing or has no id', async () => {
      await expect(service.resolveCurrentStaff(null as any)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(
        service.resolveCurrentStaff({ id: '' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException if user has no associated Person (personId is null)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ personId: null });

      await expect(
        service.resolveCurrentStaff({ id: 'user-1', personId: null }),
      ).rejects.toThrow(
        new ForbiddenException(
          'El usuario autenticado no tiene un perfil de persona asociado.',
        ),
      );
    });

    it('should throw ForbiddenException if person is not registered as Staff', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.resolveCurrentStaff({ id: 'user-1', personId: 'person-1' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'La persona asociada no está registrada como personal del club.',
        ),
      );
    });

    it('should throw ForbiddenException if Staff record is inactive (isActive = false)', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        personId: 'person-1',
        isActive: false,
        person: { id: 'person-1', name: 'Juan', lastName: 'Pérez' },
      });

      await expect(
        service.resolveCurrentStaff({ id: 'user-1', personId: 'person-1' }),
      ).rejects.toThrow(
        new ForbiddenException('El perfil de personal se encuentra inactivo.'),
      );
    });

    it('should resolve Staff successfully when user has Person and active Staff', async () => {
      const activeStaff = {
        id: 'staff-1',
        personId: 'person-1',
        isActive: true,
        person: {
          id: 'person-1',
          name: 'Juan',
          lastName: 'Pérez',
          secondLastName: 'Gómez',
          imageUrl: 'https://cdn.example.com/photo.jpg',
        },
      };
      mockPrisma.staff.findUnique.mockResolvedValueOnce(activeStaff);

      const result = await service.resolveCurrentStaff({
        id: 'user-1',
        personId: 'person-1',
      });

      expect(result).toEqual(activeStaff);
      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { personId: 'person-1' },
        include: {
          person: {
            select: {
              id: true,
              name: true,
              lastName: true,
              secondLastName: true,
              imageUrl: true,
            },
          },
        },
      });
    });
  });

  describe('2. Unified "My Groups" Query (CourseShifts + TeamCategories)', () => {
    it('should return empty groups array if staff has 0 active assignments', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        personId: 'person-1',
        isActive: true,
        person: { id: 'person-1', name: 'Carlos', lastName: 'Entrenador' },
      });
      mockPrisma.courseSeasonStaff.findMany.mockResolvedValueOnce([]);
      mockPrisma.teamSeasonStaff.findMany.mockResolvedValueOnce([]);

      const result = await service.getMyGroups({
        id: 'user-1',
        personId: 'person-1',
      });

      expect(result.staffId).toBe('staff-1');
      expect(result.groups).toEqual([]);
      expect(mockPrisma.studentMembership.groupBy).not.toHaveBeenCalled();
      expect(mockPrisma.playerMembership.groupBy).not.toHaveBeenCalled();
    });

    it('should return active course and team groups with canonical participant counts', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        personId: 'person-1',
        isActive: true,
        person: { id: 'person-1', name: 'Juan', lastName: 'Pérez' },
      });

      const now = new Date();
      const pastStart = new Date(now.getTime() - 86400000 * 10);
      const futureEnd = new Date(now.getTime() + 86400000 * 30);

      // Course assignment
      mockPrisma.courseSeasonStaff.findMany.mockResolvedValueOnce([
        {
          id: 'css-assign-1',
          staffId: 'staff-1',
          courseSeasonShiftId: 'shift-1',
          role: 'HEAD_COACH',
          customRole: null,
          isPrimary: true,
          startedAt: pastStart,
          endedAt: futureEnd,
          courseSeasonShift: {
            id: 'shift-1',
            courseSeasonId: 'cs-1',
            gender: 'MIXED',
            shift: { id: 's-1', name: 'Tarde' },
            category: { id: 'cat-1', name: 'U13' },
            courseSeason: {
              id: 'cs-1',
              course: { id: 'c-1', name: 'Básquetbol', imageUrl: null },
              season: { id: 'season-1', name: 'Temporada 2026' },
            },
          },
        },
      ]);

      // Team assignment
      mockPrisma.teamSeasonStaff.findMany.mockResolvedValueOnce([
        {
          id: 'tss-assign-1',
          staffId: 'staff-1',
          teamSeasonCategoryId: 'team-cat-1',
          role: 'ASSISTANT_COACH',
          customRole: 'Preparador Físico',
          isPrimary: false,
          startedAt: pastStart,
          endedAt: null,
          teamSeasonCategory: {
            id: 'team-cat-1',
            teamSeasonId: 'ts-1',
            gender: 'MALE',
            category: { id: 'cat-2', name: 'Mayores', minAge: 18, maxAge: 35 },
            teamSeason: {
              id: 'ts-1',
              team: { id: 't-1', name: 'Voleibol CAN', imageUrl: null },
              season: { id: 'season-1', name: 'Temporada 2026' },
            },
          },
        },
      ]);

      // Counts mocks
      mockPrisma.studentMembership.groupBy.mockResolvedValueOnce([
        { courseSeasonShiftId: 'shift-1', _count: { id: 25 } },
      ]);
      mockPrisma.cycleEnrollment.groupBy.mockResolvedValueOnce([
        { courseSeasonShiftId: 'shift-1', _count: { id: 20 } },
      ]);
      mockPrisma.playerMembership.groupBy.mockResolvedValueOnce([
        { teamSeasonCategoryId: 'team-cat-1', _count: { id: 18 } },
      ]);

      const result = await service.getMyGroups({
        id: 'user-1',
        personId: 'person-1',
      });

      expect(result.staffId).toBe('staff-1');
      expect(result.groups).toHaveLength(2);

      // Course verification
      const courseGroup = result.groups.find((g) => g.type === 'COURSE')!;
      expect(courseGroup.groupId).toBe('shift-1');
      expect(courseGroup.parentId).toBe('cs-1');
      expect(courseGroup.name).toBe('Básquetbol');
      expect(courseGroup.category).toBe('U13');
      expect(courseGroup.shift).toBe('Tarde');
      expect(courseGroup.role).toBe('HEAD_COACH');
      expect(courseGroup.isPrimary).toBe(true);
      expect(courseGroup.participantCount).toBe(20); // Vigentes confirmados
      expect(courseGroup.administrativeCount).toBe(25); // Totales administrativos

      // Team verification
      const teamGroup = result.groups.find((g) => g.type === 'TEAM')!;
      expect(teamGroup.groupId).toBe('team-cat-1');
      expect(teamGroup.parentId).toBe('ts-1');
      expect(teamGroup.name).toBe('Voleibol CAN');
      expect(teamGroup.category).toBe('Mayores');
      expect(teamGroup.role).toBe('ASSISTANT_COACH');
      expect(teamGroup.customRole).toBe('Preparador Físico');
      expect(teamGroup.participantCount).toBe(18);
    });
  });

  describe('3. Resource Access Assertions (Security Foundation)', () => {
    beforeEach(() => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: 'staff-1',
        personId: 'person-1',
        isActive: true,
      });
    });

    it('assertCourseSeasonShiftAccess: allows access when assignment is active', async () => {
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assign-1',
        staffId: 'staff-1',
        courseSeasonShiftId: 'shift-100',
      });

      const res = await service.assertCourseSeasonShiftAccess(
        { id: 'user-1', personId: 'person-1' },
        'shift-100',
      );

      expect(res.assignment.id).toBe('assign-1');
    });

    it('assertCourseSeasonShiftAccess: throws ForbiddenException 403 when unassigned or expired', async () => {
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertCourseSeasonShiftAccess(
          { id: 'user-1', personId: 'person-1' },
          'shift-999',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('assertTeamSeasonCategoryAccess: allows access when assignment is active', async () => {
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assign-2',
        staffId: 'staff-1',
        teamSeasonCategoryId: 'cat-200',
      });

      const res = await service.assertTeamSeasonCategoryAccess(
        { id: 'user-1', personId: 'person-1' },
        'cat-200',
      );

      expect(res.assignment.id).toBe('assign-2');
    });

    it('assertTeamSeasonCategoryAccess: throws ForbiddenException 403 when unassigned or expired', async () => {
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertTeamSeasonCategoryAccess(
          { id: 'user-1', personId: 'person-1' },
          'cat-999',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('assertSessionAccess: allows access when session is attached to assigned CourseSeasonShift', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 'session-1',
        sessionCourses: [{ courseSeasonShiftId: 'shift-100' }],
        sessionTeams: [],
      });
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assign-1',
        staffId: 'staff-1',
        courseSeasonShiftId: 'shift-100',
      });

      const res = await service.assertSessionAccess(
        { id: 'user-1', personId: 'person-1' },
        'session-1',
      );

      expect(res.groupType).toBe('COURSE');
      expect(res.groupId).toBe('shift-100');
    });

    it('assertSessionAccess: allows access when session is attached to assigned TeamSeasonCategory', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 'session-2',
        sessionCourses: [],
        sessionTeams: [{ teamSeasonCategoryId: 'cat-200' }],
      });
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assign-2',
        staffId: 'staff-1',
        teamSeasonCategoryId: 'cat-200',
      });

      const res = await service.assertSessionAccess(
        { id: 'user-1', personId: 'person-1' },
        'session-2',
      );

      expect(res.groupType).toBe('TEAM');
      expect(res.groupId).toBe('cat-200');
    });

    it('assertSessionAccess: throws NotFoundException when session does not exist', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.assertSessionAccess(
          { id: 'user-1', personId: 'person-1' },
          'session-nonexistent',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('assertSessionAccess: throws ForbiddenException 403 when session belongs to unassigned group', async () => {
      mockPrisma.session.findUnique.mockResolvedValueOnce({
        id: 'session-unassigned',
        sessionCourses: [{ courseSeasonShiftId: 'shift-999' }],
        sessionTeams: [],
      });
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertSessionAccess(
          { id: 'user-1', personId: 'person-1' },
          'session-unassigned',
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'No tiene asignación docente activa sobre el curso o equipo de esta sesión.',
        ),
      );
    });
  });

  describe('4. Participant Access Assertions (Attendance & Evaluation Integrity)', () => {
    beforeEach(() => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: 'staff-1',
        personId: 'person-1',
        isActive: true,
      });
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({
        id: 'assign-1',
        staffId: 'staff-1',
        courseSeasonShiftId: 'shift-1',
      });
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValue({
        id: 'assign-2',
        staffId: 'staff-1',
        teamSeasonCategoryId: 'team-cat-1',
      });
    });

    it('assertParticipantAccess (COURSE): allows access when student has confirmed cycle in shift', async () => {
      mockPrisma.cycleEnrollment.findFirst.mockResolvedValueOnce({
        id: 'cycle-1',
        studentMembershipId: 'sm-1',
      });

      const res = await service.assertParticipantAccess(
        { id: 'user-1', personId: 'person-1' },
        {
          groupId: 'shift-1',
          groupType: 'COURSE',
          studentId: 'student-1',
        },
      );

      expect(res).toBe(true);
    });

    it('assertParticipantAccess (COURSE): throws ForbiddenException when student has no active cycle in shift', async () => {
      mockPrisma.cycleEnrollment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertParticipantAccess(
          { id: 'user-1', personId: 'person-1' },
          {
            groupId: 'shift-1',
            groupType: 'COURSE',
            studentId: 'student-unregistered',
          },
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'El estudiante no cuenta con inscripción confirmada/vigente en este turno.',
        ),
      );
    });

    it('assertParticipantAccess (TEAM): allows access when player has active membership in category', async () => {
      mockPrisma.playerMembership.findFirst.mockResolvedValueOnce({
        id: 'pm-1',
        playerId: 'player-1',
      });

      const res = await service.assertParticipantAccess(
        { id: 'user-1', personId: 'person-1' },
        {
          groupId: 'team-cat-1',
          groupType: 'TEAM',
          playerId: 'player-1',
        },
      );

      expect(res).toBe(true);
    });

    it('assertParticipantAccess (TEAM): throws ForbiddenException when player has no active membership in category', async () => {
      mockPrisma.playerMembership.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertParticipantAccess(
          { id: 'user-1', personId: 'person-1' },
          {
            groupId: 'team-cat-1',
            groupType: 'TEAM',
            playerId: 'player-other',
          },
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'El jugador no cuenta con membresía activa en esta categoría del equipo.',
        ),
      );
    });
  });

  describe('6. Staff Context Self-Check (Phase B: getStaffContext)', () => {
    it('returns isStaff: false without throwing if user has no Person or is not staff', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ personId: null });

      const res = await service.getStaffContext({ id: 'user-no-person' });
      expect(res).toEqual({
        isStaff: false,
        staffId: null,
        hasAssignments: false,
        activeGroupsCount: 0,
      });
    });

    it('returns isStaff: false without throwing if staff is inactive', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-inactive',
        isActive: false,
      });

      const res = await service.getStaffContext({
        id: 'user-1',
        personId: 'person-1',
      });
      expect(res).toEqual({
        isStaff: false,
        staffId: null,
        hasAssignments: false,
        activeGroupsCount: 0,
      });
    });

    it('returns isStaff: true and hasAssignments: false if active staff has 0 assignments', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        isActive: true,
      });
      mockPrisma.courseSeasonStaff.count.mockResolvedValueOnce(0);
      mockPrisma.teamSeasonStaff.count.mockResolvedValueOnce(0);

      const res = await service.getStaffContext({
        id: 'user-1',
        personId: 'person-1',
      });
      expect(res).toEqual({
        isStaff: true,
        staffId: 'staff-1',
        hasAssignments: false,
        activeGroupsCount: 0,
      });
    });

    it('returns isStaff: true and hasAssignments: true with total group count', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-1',
        isActive: true,
      });
      mockPrisma.courseSeasonStaff.count.mockResolvedValueOnce(2);
      mockPrisma.teamSeasonStaff.count.mockResolvedValueOnce(1);

      const res = await service.getStaffContext({
        id: 'user-1',
        personId: 'person-1',
      });
      expect(res).toEqual({
        isStaff: true,
        staffId: 'staff-1',
        hasAssignments: true,
        activeGroupsCount: 3,
      });
    });
  });

  describe('7. Teacher Dashboard Aggregation (Phase B: getTeacherDashboard)', () => {
    const mockStaff = {
      id: 'staff-1',
      isActive: true,
      person: {
        id: 'person-1',
        name: 'Roberto',
        lastName: 'Pérez',
        secondLastName: 'Gómez',
        imageUrl: null,
      },
    };

    it('should aggregate metrics correctly and leave upcomingSessions undefined if lacking READ_SESSIONS', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findMany.mockResolvedValueOnce([]);
      mockPrisma.teamSeasonStaff.findMany.mockResolvedValueOnce([]);

      const res = await service.getTeacherDashboard({
        id: 'user-1',
        personId: 'person-1',
        permissions: ['READ_SESSION_BOOKINGS'], // No READ_SESSIONS
      });

      expect(res.staffId).toBe('staff-1');
      expect(res.person.name).toBe('Roberto');
      expect(res.stats.activeGroups).toBe(0);
      expect(res.stats.upcomingSessionsCount).toBeUndefined();
      expect(res.upcomingSessions).toBeUndefined();
    });

    it('should return empty upcoming sessions when user has READ_SESSIONS but 0 assigned groups', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findMany.mockResolvedValueOnce([]);
      mockPrisma.teamSeasonStaff.findMany.mockResolvedValueOnce([]);

      const res = await service.getTeacherDashboard({
        id: 'user-1',
        personId: 'person-1',
        permissions: ['READ_SESSIONS'],
      });

      expect(res.stats.upcomingSessionsCount).toBe(0);
      expect(res.upcomingSessions).toEqual([]);
    });

    it('should query upcoming sessions ONLY for assigned groups when user has READ_SESSIONS', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      // 1 course group assigned
      mockPrisma.courseSeasonStaff.findMany.mockResolvedValueOnce([
        {
          courseSeasonShiftId: 'shift-1',
          startedAt: new Date('2026-01-01'),
          endedAt: null,
          role: 'HEAD_COACH',
          customRole: null,
          isPrimary: true,
          courseSeasonShift: {
            id: 'shift-1',
            courseSeasonId: 'cs-1',
            shift: { id: 's-1', name: 'Turno Tarde' },
            category: { id: 'c-1', name: 'U13' },
            gender: 'MIXED',
            courseSeason: {
              course: { id: 'c-1', name: 'Básquetbol', imageUrl: null },
              season: { id: 'seas-1', name: 'Temporada 2026' },
            },
          },
        },
      ]);
      mockPrisma.teamSeasonStaff.findMany.mockResolvedValueOnce([]);
      mockPrisma.studentMembership.groupBy.mockResolvedValueOnce([
        { courseSeasonShiftId: 'shift-1', _count: { id: 10 } },
      ]);
      mockPrisma.cycleEnrollment.groupBy.mockResolvedValueOnce([
        { courseSeasonShiftId: 'shift-1', _count: { id: 8 } },
      ]);

      // Mock upcoming sessions returned from DB
      const sessionDate = new Date('2026-10-20T17:30:00Z');
      mockPrisma.session.findMany.mockResolvedValueOnce([
        {
          id: 'session-101',
          durationMin: 90,
          event: {
            id: 'event-101',
            title: 'Entrenamiento Táctico',
            startDate: sessionDate,
            endDate: new Date(sessionDate.getTime() + 90 * 60000),
            location: {
              id: 'loc-1',
              name: 'Cancha Central',
              address: 'Av. Costanera #45',
            },
          },
          sessionCourses: [
            {
              courseSeasonShiftId: 'shift-1',
              courseSeasonShift: {
                id: 'shift-1',
                shift: { id: 's-1', name: 'Turno Tarde' },
                category: { id: 'c-1', name: 'U13' },
                courseSeason: {
                  course: { id: 'c-1', name: 'Básquetbol' },
                },
              },
            },
          ],
          sessionTeams: [],
        },
      ]);

      const res = await service.getTeacherDashboard({
        id: 'user-1',
        personId: 'person-1',
        permissions: ['READ_SESSIONS'],
      });

      expect(res.stats.activeGroups).toBe(1);
      expect(res.stats.courseGroups).toBe(1);
      expect(res.stats.teamGroups).toBe(0);
      expect(res.stats.currentParticipants).toBe(8);
      expect(res.stats.administrativeParticipants).toBe(10);
      expect(res.stats.upcomingSessionsCount).toBe(1);
      expect(res.upcomingSessions).toHaveLength(1);
      expect(res.upcomingSessions![0].title).toBe('Entrenamiento Táctico');
      expect(res.upcomingSessions![0].groupName).toBe('Básquetbol');
      expect(res.upcomingSessions![0].groupDetail).toBe('Turno Tarde (U13)');
      expect(res.upcomingSessions![0].location?.name).toBe('Cancha Central');

      // Verify that prisma.session.findMany was called with where clause filtering by assigned shiftId
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                sessionCourses: {
                  some: {
                    courseSeasonShiftId: { in: ['shift-1'] },
                  },
                },
              },
            ],
          }),
        }),
      );
    });
  });

  describe('8. Group Workspace Context (Phase C: getGroupContext)', () => {
    const mockStaff = {
      id: 'staff-1',
      isActive: true,
      person: {
        id: 'person-1',
        name: 'Carlos',
        lastName: 'Alonso',
        secondLastName: 'Ruiz',
        imageUrl: null,
      },
    };

    it('should reject with BadRequestException when group type is invalid', async () => {
      await expect(
        service.getGroupContext({ id: 'user-1' }, 'INVALID', 'shift-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject with ForbiddenException when staff is inactive', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce({
        id: 'staff-inactive',
        isActive: false,
      });

      await expect(
        service.getGroupContext(
          { id: 'user-1', personId: 'person-1' },
          'COURSE',
          'shift-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with ForbiddenException when staff is unassigned or expired for COURSE', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getGroupContext(
          { id: 'user-1', personId: 'person-1' },
          'COURSE',
          'unassigned-shift',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with ForbiddenException when staff is unassigned or expired for TEAM', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getGroupContext(
          { id: 'user-1', personId: 'person-1' },
          'TEAM',
          'unassigned-cat',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject with NotFoundException when assigned course shift is missing in DB', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'HEAD_COACH',
        isPrimary: true,
      });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getGroupContext(
          { id: 'user-1', personId: 'person-1' },
          'COURSE',
          'shift-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject with NotFoundException when assigned team category is missing in DB', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'HEAD_COACH',
        isPrimary: true,
      });
      mockPrisma.teamSeasonCategory.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getGroupContext(
          { id: 'user-1', personId: 'person-1' },
          'TEAM',
          'cat-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return COURSE group context with canonical participants and sessions when authorized', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'HEAD_COACH',
        customRole: null,
        isPrimary: true,
      });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: 'shift-1',
        courseSeasonId: 'cs-1',
        shiftId: 's-1',
        gender: 'MIXED',
        shift: { id: 's-1', name: 'Turno Tarde' },
        category: { id: 'c-1', name: 'U13' },
        courseSeason: {
          course: { id: 'course-1', name: 'Básquetbol', imageUrl: null },
          season: { id: 'seas-1', name: '2026' },
        },
      });

      // Canonical enrollments for roster
      mockPrisma.cycleEnrollment.findMany.mockResolvedValueOnce([
        {
          id: 'enrollment-1',
          status: 'CONFIRMED',
          studentMembership: {
            id: 'sm-1',
            status: 'ACTIVE',
            student: {
              id: 'stud-1',
              person: {
                id: 'p-1',
                name: 'Alejandro',
                lastName: 'Gómez',
                secondLastName: null,
                imageUrl: null,
                documentNumber: '98765432',
                birthDate: new Date('2013-03-10'),
              },
            },
          },
        },
      ]);
      mockPrisma.studentMembership.count.mockResolvedValueOnce(1);

      // Sessions (1 upcoming, 1 recent)
      const futureDate = new Date('2026-10-25T17:00:00Z');
      const pastDate = new Date('2026-10-10T17:00:00Z');
      mockPrisma.session.findMany
        .mockResolvedValueOnce([
          {
            id: 'sess-future',
            durationMin: 90,
            event: {
              id: 'ev-1',
              title: 'Práctica Táctica',
              startDate: futureDate,
              endDate: new Date(futureDate.getTime() + 90 * 60000),
              status: 'SCHEDULED',
              location: { id: 'loc-1', name: 'Cancha 1', address: 'Costanera' },
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'sess-past',
            durationMin: 90,
            event: {
              id: 'ev-2',
              title: 'Práctica Física',
              startDate: pastDate,
              endDate: new Date(pastDate.getTime() + 90 * 60000),
              status: 'SCHEDULED',
              location: null,
            },
          },
        ]);

      const res = await service.getGroupContext(
        {
          id: 'user-1',
          personId: 'person-1',
          permissions: ['READ_STUDENTS', 'READ_SESSIONS'],
        },
        'COURSE',
        'shift-1',
      );

      expect(res.type).toBe('COURSE');
      expect(res.name).toBe('Básquetbol');
      expect(res.detail).toBe('Turno Tarde (U13)');
      expect(res.role).toBe('HEAD_COACH');
      expect(res.isPrimary).toBe(true);
      expect(res.participantCount).toBe(1);
      expect(res.administrativeCount).toBe(1);
      expect(res.course?.shiftName).toBe('Turno Tarde');

      // Participants
      expect(res.participants).toHaveLength(1);
      expect(res.participants![0].firstName).toBe('Alejandro');
      expect(res.participants![0].lastName).toBe('Gómez');
      expect(res.participants![0].documentNumber).toBe('98765432');

      // Sessions
      expect(res.upcomingSessions).toHaveLength(1);
      expect(res.upcomingSessions![0].id).toBe('sess-future');
      expect(res.recentSessions).toHaveLength(1);
      expect(res.recentSessions![0].id).toBe('sess-past');
    });

    it('should return TEAM group context with canonical participants when authorized', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'HEAD_COACH',
        customRole: null,
        isPrimary: true,
      });
      mockPrisma.teamSeasonCategory.findUnique.mockResolvedValueOnce({
        id: 'cat-1',
        teamSeasonId: 'ts-1',
        gender: 'FEMALE',
        category: { id: 'c-1', name: 'Mayores' },
        teamSeason: {
          team: { id: 'team-1', name: 'Voleibol Femenino', imageUrl: null },
          season: { id: 'seas-1', name: '2026' },
        },
      });

      mockPrisma.playerMembership.findMany.mockResolvedValueOnce([
        {
          id: 'pm-1',
          status: 'ACTIVE',
          player: {
            id: 'play-1',
            person: {
              id: 'p-2',
              name: 'Lucía',
              lastName: 'Fernández',
              secondLastName: null,
              imageUrl: null,
              documentNumber: '87654321',
              birthDate: new Date('2004-06-15'),
            },
          },
        },
      ]);
      mockPrisma.session.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const res = await service.getGroupContext(
        {
          id: 'user-1',
          personId: 'person-1',
          permissions: ['READ_PLAYERS', 'READ_SESSIONS'],
        },
        'TEAM',
        'cat-1',
      );

      expect(res.type).toBe('TEAM');
      expect(res.name).toBe('Voleibol Femenino');
      expect(res.detail).toBe('Categoría Mayores (FEMALE)');
      expect(res.participants).toHaveLength(1);
      expect(res.participants![0].type).toBe('PLAYER');
      expect(res.participants![0].firstName).toBe('Lucía');
      expect(res.upcomingSessions).toEqual([]);
      expect(res.recentSessions).toEqual([]);
    });

    it('should leave participants undefined if user lacks participant read permissions', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'ASSISTANT_COACH',
        isPrimary: false,
      });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: 'shift-1',
        courseSeasonId: 'cs-1',
        shiftId: 's-1',
        shift: { id: 's-1', name: 'Turno Mañana' },
        category: { id: 'c-1', name: 'U11' },
        courseSeason: {
          course: { id: 'course-1', name: 'Fútbol', imageUrl: null },
          season: { id: 'seas-1', name: '2026' },
        },
      });
      mockPrisma.cycleEnrollment.count.mockResolvedValueOnce(15);
      mockPrisma.studentMembership.count.mockResolvedValueOnce(18);

      const res = await service.getGroupContext(
        {
          id: 'user-1',
          personId: 'person-1',
          permissions: [], // No permissions
        },
        'COURSE',
        'shift-1',
      );

      expect(res.participants).toBeUndefined();
      expect(res.participantCount).toBe(15);
      expect(res.administrativeCount).toBe(18);
      expect(res.upcomingSessions).toBeUndefined();
      expect(res.recentSessions).toBeUndefined();
    });

    it('should query sessions strictly filtered by group ID in DB', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
        role: 'HEAD_COACH',
        isPrimary: true,
      });
      mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
        id: 'shift-target',
        courseSeasonId: 'cs-1',
        shiftId: 's-1',
        shift: { id: 's-1', name: 'Turno Noche' },
        category: { id: 'c-1', name: 'U15' },
        courseSeason: {
          course: { id: 'course-1', name: 'Tenis', imageUrl: null },
          season: { id: 'seas-1', name: '2026' },
        },
      });
      mockPrisma.studentMembership.count.mockResolvedValueOnce(0);
      mockPrisma.session.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getGroupContext(
        {
          id: 'user-1',
          personId: 'person-1',
          permissions: ['READ_SESSIONS'],
        },
        'COURSE',
        'shift-target',
      );

      // Verify that prisma.session.findMany used sessionCourses filter for shift-target
      expect(mockPrisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessionCourses: { some: { courseSeasonShiftId: 'shift-target' } },
          }),
        }),
      );
    });
  });

  describe('9. Session Attendance Roster & Bulk Attendance (Phase D)', () => {
    const mockSession = {
      id: 'session-1',
      durationMin: 90,
      event: {
        id: 'event-1',
        title: 'Entrenamiento Juvenil',
        startDate: new Date('2026-10-25T15:00:00Z'),
        endDate: new Date('2026-10-25T16:30:00Z'),
        status: 'SCHEDULED',
        location: {
          id: 'loc-1',
          name: 'Cancha Principal',
          address: 'Calle Deportes 123',
        },
      },
    };

    it('getSessionAttendanceRoster: rejects invalid group type with BadRequestException', async () => {
      await expect(
        service.getSessionAttendanceRoster(
          { id: 'u1', personId: 'p1' },
          'INVALID',
          'group-1',
          'session-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('getSessionAttendanceRoster: rejects when session is not linked to requested CourseShift', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
      });
      mockPrisma.sessionCourse.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getSessionAttendanceRoster(
          { id: 'u1', personId: 'p1', permissions: ['READ_SESSION_BOOKINGS'] },
          'COURSE',
          'shift-1',
          'session-unknown',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('getSessionAttendanceRoster (COURSE): returns canonical roster for session date merged with existing bookings', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
      });

      mockPrisma.sessionCourse.findFirst.mockResolvedValueOnce({
        sessionId: 'session-1',
        courseSeasonShiftId: 'shift-1',
        session: mockSession,
        courseSeasonShift: {
          id: 'shift-1',
          shift: { name: 'Tarde' },
          category: { name: 'U13' },
          courseSeason: {
            course: { name: 'Básquetbol Infantil' },
          },
        },
      });

      // Existing booking in DB for student-1
      mockPrisma.sessionBooking.findMany.mockResolvedValueOnce([
        {
          id: 'booking-1',
          studentId: 'student-1',
          attended: true,
          isExternal: false,
          student: {
            id: 'student-1',
            person: {
              name: 'Lucas',
              lastName: 'Alvarez',
              secondLastName: null,
              imageUrl: null,
              documentNumber: '123456',
              birthDate: new Date('2014-05-10'),
            },
          },
        },
      ]);

      // Canonical enrollments for sessionDate: student-1 (has booking) and student-2 (unregistered)
      mockPrisma.cycleEnrollment.findMany.mockResolvedValueOnce([
        {
          studentMembershipId: 'mem-1',
          studentMembership: {
            student: {
              id: 'student-1',
              person: {
                id: 'p-1',
                name: 'Lucas',
                lastName: 'Alvarez',
                secondLastName: null,
                imageUrl: null,
                documentNumber: '123456',
                birthDate: new Date('2014-05-10'),
              },
            },
          },
        },
        {
          studentMembershipId: 'mem-2',
          studentMembership: {
            student: {
              id: 'student-2',
              person: {
                id: 'p-2',
                name: 'Mateo',
                lastName: 'Benitez',
                secondLastName: 'Rojas',
                imageUrl: null,
                documentNumber: '789012',
                birthDate: new Date('2014-08-15'),
              },
            },
          },
        },
      ]);

      const res = await service.getSessionAttendanceRoster(
        { id: 'u1', personId: 'p1', permissions: ['READ_SESSION_BOOKINGS'] },
        'COURSE',
        'shift-1',
        'session-1',
      );

      expect(res.session.id).toBe('session-1');
      expect(res.group.name).toBe('Básquetbol Infantil');
      expect(res.participants.length).toBe(2);

      // Student 1: attended true with bookingId
      const p1 = res.participants.find((p) => p.participantId === 'student-1');
      expect(p1?.attendance.attended).toBe(true);
      expect(p1?.attendance.bookingId).toBe('booking-1');

      // Student 2: unregistered (attended null)
      const p2 = res.participants.find((p) => p.participantId === 'student-2');
      expect(p2?.attendance.attended).toBeNull();
      expect(p2?.attendance.bookingId).toBeNull();

      expect(res.summary).toEqual({
        total: 2,
        present: 1,
        absent: 0,
        unregistered: 1,
      });
    });

    it('saveSessionAttendanceBulk: rejects invalid participant with BadRequestException (All-or-Nothing)', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
      });
      mockPrisma.sessionCourse.findFirst.mockResolvedValueOnce({
        sessionId: 'session-1',
        courseSeasonShiftId: 'shift-1',
        session: mockSession,
      });

      // Allowed roster only has student-valid
      mockPrisma.cycleEnrollment.findMany.mockResolvedValueOnce([
        {
          studentMembership: { studentId: 'student-valid' },
        },
      ]);
      mockPrisma.sessionBooking.findMany.mockResolvedValueOnce([]);

      // Payload tries to submit student-valid AND student-intruder
      const payload = {
        entries: [
          { participantId: 'student-valid', attended: true },
          { participantId: 'student-intruder', attended: true },
        ],
      };

      await expect(
        service.saveSessionAttendanceBulk(
          {
            id: 'u1',
            personId: 'p1',
            permissions: ['CREATE_SESSION_BOOKINGS', 'UPDATE_SESSION_BOOKINGS'],
          },
          'COURSE',
          'shift-1',
          'session-1',
          payload,
        ),
      ).rejects.toThrow(BadRequestException);

      // Verify that transaction was NEVER opened
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('saveSessionAttendanceBulk: saves valid entries atomically via transaction upserts', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'assignment-1',
      });
      mockPrisma.sessionCourse.findFirst.mockResolvedValueOnce({
        sessionId: 'session-1',
        courseSeasonShiftId: 'shift-1',
        session: mockSession,
      });

      // Allowed roster contains student-1 and student-2
      mockPrisma.cycleEnrollment.findMany.mockResolvedValueOnce([
        { studentMembership: { studentId: 'student-1' } },
        { studentMembership: { studentId: 'student-2' } },
      ]);
      mockPrisma.sessionBooking.findMany.mockResolvedValueOnce([]);

      // Mock transaction execution
      const mockTxUpsert = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => {
        return cb({
          sessionBooking: {
            upsert: mockTxUpsert,
          },
        });
      });

      const payload = {
        entries: [
          { participantId: 'student-1', attended: true },
          { participantId: 'student-2', attended: false },
        ],
      };

      const res = await service.saveSessionAttendanceBulk(
        {
          id: 'u1',
          personId: 'p1',
          permissions: ['CREATE_SESSION_BOOKINGS'],
        },
        'COURSE',
        'shift-1',
        'session-1',
        payload,
      );

      expect(res.sessionId).toBe('session-1');
      expect(res.savedCount).toBe(2);
      expect(res.presentCount).toBe(1);
      expect(res.absentCount).toBe(1);

      // Verify upsert calls inside transaction
      expect(mockTxUpsert).toHaveBeenCalledTimes(2);
      expect(mockTxUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sessionId_studentId: {
              sessionId: 'session-1',
              studentId: 'student-1',
            },
          },
          create: expect.objectContaining({
            sessionId: 'session-1',
            studentId: 'student-1',
            attended: true,
          }),
        }),
      );
    });

    it('saveSessionAttendanceBulk (TEAM): works idempotently with player participants', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
        id: 'team-assign-1',
      });
      mockPrisma.sessionTeam.findFirst.mockResolvedValueOnce({
        sessionId: 'session-team-1',
        teamSeasonCategoryId: 'cat-1',
        session: mockSession,
      });

      mockPrisma.playerMembership.findMany.mockResolvedValueOnce([
        { playerId: 'player-10' },
      ]);
      mockPrisma.sessionBooking.findMany.mockResolvedValueOnce([]);

      const mockTxUpsert = jest.fn().mockResolvedValue({});
      mockPrisma.$transaction.mockImplementationOnce(async (cb: any) => {
        return cb({
          sessionBooking: {
            upsert: mockTxUpsert,
          },
        });
      });

      const res = await service.saveSessionAttendanceBulk(
        {
          id: 'u1',
          personId: 'p1',
          permissions: ['UPDATE_SESSION_BOOKINGS'],
        },
        'TEAM',
        'cat-1',
        'session-team-1',
        {
          entries: [{ participantId: 'player-10', attended: true }],
        },
      );

      expect(res.savedCount).toBe(1);
      expect(res.presentCount).toBe(1);
      expect(mockTxUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sessionId_playerId: {
              sessionId: 'session-team-1',
              playerId: 'player-10',
            },
          },
        }),
      );
    });
  });

  describe('Phase E1: Group Traceability & Evaluation Security', () => {
    const teacherUser = {
      id: 'user-teacher-1',
      personId: 'person-teacher-1',
      permissions: [
        'READ_PROGRESS_EVALUATIONS',
        'CREATE_PROGRESS_EVALUATIONS',
        'UPDATE_PROGRESS_EVALUATIONS',
      ],
    };

    const teacherStaff = {
      id: 'staff-teacher-1',
      isActive: true,
      person: {
        id: 'person-teacher-1',
        name: 'Carlos',
        lastName: 'Mendoza',
        secondLastName: 'Alvarez',
      },
    };

    const otherTeacherStaff = {
      id: 'staff-teacher-2',
      isActive: true,
      person: {
        id: 'person-teacher-2',
        name: 'Maria',
        lastName: 'Flores',
      },
    };

    beforeEach(() => {
      mockPrisma.staff.findUnique.mockResolvedValue(teacherStaff);
    });

    describe('getGroupEvaluations', () => {
      it('should throw ForbiddenException if user lacks READ_PROGRESS_EVALUATIONS', async () => {
        await expect(
          service.getGroupEvaluations(
            { id: 'user-1', personId: 'p-1', permissions: [] },
            'COURSE',
            'shift-1',
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw BadRequestException for invalid group type', async () => {
        await expect(
          service.getGroupEvaluations(teacherUser, 'INVALID_TYPE', 'shift-1'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should query COURSE evaluations with explicit courseSeasonShiftId', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findMany.mockResolvedValueOnce([
          {
            id: 'eval-1',
            courseSeasonShiftId: 'shift-1',
            studentId: 'student-1',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date('2026-06-15'),
            technicalScore: 85,
            tacticalScore: 90,
            physicalScore: 80,
            behaviorScore: 95,
            notes: 'Buen desempeño',
            student: {
              person: { name: 'Juan', lastName: 'Perez', secondLastName: 'G' },
            },
            evaluatorStaff: {
              person: { name: 'Carlos', lastName: 'Mendoza' },
            },
          },
        ]);

        const result = await service.getGroupEvaluations(
          teacherUser,
          'COURSE',
          'shift-1',
        );

        expect(mockPrisma.progressEvaluation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { courseSeasonShiftId: 'shift-1' },
            orderBy: { evaluationDate: 'desc' },
          }),
        );
        expect(result.total).toBe(1);
        expect(result.evaluations[0].canEdit).toBe(true);
        expect(result.evaluations[0].participantId).toBe('student-1');
      });

      it('should query TEAM evaluations with explicit teamSeasonCategoryId', async () => {
        mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'tss-1',
          staffId: teacherStaff.id,
          teamSeasonCategoryId: 'cat-u15',
        });

        mockPrisma.progressEvaluation.findMany.mockResolvedValueOnce([
          {
            id: 'eval-2',
            teamSeasonCategoryId: 'cat-u15',
            playerId: 'player-1',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date('2026-06-20'),
            technicalScore: 88,
            tacticalScore: 85,
            physicalScore: 92,
            behaviorScore: 80,
            notes: 'Excelente trabajo en equipo',
            player: {
              person: { name: 'Pedro', lastName: 'Gomez' },
            },
            evaluatorStaff: {
              person: { name: 'Carlos', lastName: 'Mendoza' },
            },
          },
        ]);

        const result = await service.getGroupEvaluations(
          teacherUser,
          'TEAM',
          'cat-u15',
        );

        expect(mockPrisma.progressEvaluation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { teamSeasonCategoryId: 'cat-u15' },
          }),
        );
        expect(result.total).toBe(1);
        expect(result.evaluations[0].participantId).toBe('player-1');
      });

      it('should prevent cross-group leak: Student in two groups in same season', async () => {
        // Docente consulta Shift A
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-A',
        });

        // La base de datos solo retorna registros donde courseSeasonShiftId = shift-A
        mockPrisma.progressEvaluation.findMany.mockImplementationOnce(
          async ({ where }: any) => {
            if (where.courseSeasonShiftId === 'shift-A') {
              return [
                {
                  id: 'eval-shift-a',
                  courseSeasonShiftId: 'shift-A',
                  studentId: 'student-cross-1',
                  evaluatorStaffId: teacherStaff.id,
                  evaluationDate: new Date('2026-07-01'),
                  student: { person: { name: 'Lucas', lastName: 'Silva' } },
                  evaluatorStaff: {
                    person: { name: 'Carlos', lastName: 'Mendoza' },
                  },
                },
              ];
            }
            return [];
          },
        );

        const result = await service.getGroupEvaluations(
          teacherUser,
          'COURSE',
          'shift-A',
          'student-cross-1',
        );

        expect(result.evaluations).toHaveLength(1);
        expect(result.evaluations[0].id).toBe('eval-shift-a');
        expect(mockPrisma.progressEvaluation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              courseSeasonShiftId: 'shift-A',
              studentId: 'student-cross-1',
            },
          }),
        );
      });

      it('should prevent cross-category leak: Player in U15 and U17 in same season', async () => {
        mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'tss-1',
          staffId: teacherStaff.id,
          teamSeasonCategoryId: 'cat-U15',
        });

        mockPrisma.progressEvaluation.findMany.mockResolvedValueOnce([
          {
            id: 'eval-u15',
            teamSeasonCategoryId: 'cat-U15',
            playerId: 'player-cross-1',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date('2026-07-05'),
            player: { person: { name: 'Mateo', lastName: 'Rios' } },
            evaluatorStaff: {
              person: { name: 'Carlos', lastName: 'Mendoza' },
            },
          },
        ]);

        const result = await service.getGroupEvaluations(
          teacherUser,
          'TEAM',
          'cat-U15',
          'player-cross-1',
        );

        expect(result.evaluations).toHaveLength(1);
        expect(result.evaluations[0].id).toBe('eval-u15');
        expect(mockPrisma.progressEvaluation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              teamSeasonCategoryId: 'cat-U15',
              playerId: 'player-cross-1',
            },
          }),
        );
      });

      it('should allow multiple staff in same group to see evaluations but flag canEdit correctly', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findMany.mockResolvedValueOnce([
          {
            id: 'eval-by-me',
            courseSeasonShiftId: 'shift-1',
            studentId: 'student-1',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date('2026-07-10'),
            student: { person: { name: 'Juan', lastName: 'Perez' } },
            evaluatorStaff: {
              person: { name: 'Carlos', lastName: 'Mendoza' },
            },
          },
          {
            id: 'eval-by-other',
            courseSeasonShiftId: 'shift-1',
            studentId: 'student-1',
            evaluatorStaffId: otherTeacherStaff.id,
            evaluationDate: new Date('2026-07-08'),
            student: { person: { name: 'Juan', lastName: 'Perez' } },
            evaluatorStaff: {
              person: { name: 'Maria', lastName: 'Flores' },
            },
          },
        ]);

        const result = await service.getGroupEvaluations(
          teacherUser,
          'COURSE',
          'shift-1',
        );

        expect(result.evaluations).toHaveLength(2);
        // La evaluación propia tiene canEdit = true
        expect(result.evaluations[0].canEdit).toBe(true);
        // La evaluación de otro docente tiene canEdit = false
        expect(result.evaluations[1].canEdit).toBe(false);
      });
    });

    describe('createGroupEvaluation', () => {
      it('should throw ForbiddenException if user lacks CREATE_PROGRESS_EVALUATIONS', async () => {
        await expect(
          service.createGroupEvaluation(
            { id: 'user-1', personId: 'p-1', permissions: ['READ_PROGRESS_EVALUATIONS'] },
            'COURSE',
            'shift-1',
            {
              participantId: 'student-1',
              evaluationDate: new Date(),
            },
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should derive seasonId and evaluatorStaffId server-side for COURSE', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
          id: 'shift-1',
          courseSeason: { seasonId: 'season-2026' },
        });

        // Participante pertenece al turno
        mockPrisma.cycleEnrollment.findFirst.mockResolvedValueOnce({
          id: 'enrollment-1',
        });

        mockPrisma.progressEvaluation.create.mockResolvedValueOnce({
          id: 'new-eval-1',
          studentId: 'student-1',
          courseSeasonShiftId: 'shift-1',
          seasonId: 'season-2026',
          evaluatorStaffId: teacherStaff.id,
          evaluationDate: new Date('2026-07-15'),
          technicalScore: 90,
          tacticalScore: 85,
          physicalScore: 80,
          behaviorScore: 95,
          notes: 'Gran progreso',
          student: { person: { name: 'Juan', lastName: 'Perez' } },
          evaluatorStaff: { person: { name: 'Carlos', lastName: 'Mendoza' } },
        });

        const created = await service.createGroupEvaluation(
          teacherUser,
          'COURSE',
          'shift-1',
          {
            participantId: 'student-1',
            evaluationDate: new Date('2026-07-15'),
            technicalScore: 90,
            tacticalScore: 85,
            physicalScore: 80,
            behaviorScore: 95,
            notes: 'Gran progreso',
          },
        );

        expect(mockPrisma.progressEvaluation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              studentId: 'student-1',
              courseSeasonShiftId: 'shift-1',
              seasonId: 'season-2026', // Derivado desde el turno
              evaluatorStaffId: teacherStaff.id, // Derivado desde la sesión autenticada
              technicalScore: 90,
            }),
          }),
        );
        expect(created.canEdit).toBe(true);
      });

      it('should derive seasonId and evaluatorStaffId server-side for TEAM', async () => {
        mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'tss-1',
          staffId: teacherStaff.id,
          teamSeasonCategoryId: 'cat-u15',
        });

        mockPrisma.teamSeasonCategory.findUnique.mockResolvedValueOnce({
          id: 'cat-u15',
          teamSeason: { seasonId: 'season-team-2026' },
        });

        mockPrisma.playerMembership.findFirst.mockResolvedValueOnce({
          id: 'membership-1',
        });

        mockPrisma.progressEvaluation.create.mockResolvedValueOnce({
          id: 'new-eval-team',
          playerId: 'player-1',
          teamSeasonCategoryId: 'cat-u15',
          seasonId: 'season-team-2026',
          evaluatorStaffId: teacherStaff.id,
          evaluationDate: new Date('2026-07-16'),
          player: { person: { name: 'Pedro', lastName: 'Gomez' } },
          evaluatorStaff: { person: { name: 'Carlos', lastName: 'Mendoza' } },
        });

        const created = await service.createGroupEvaluation(
          teacherUser,
          'TEAM',
          'cat-u15',
          {
            participantId: 'player-1',
            evaluationDate: new Date('2026-07-16'),
          },
        );

        expect(mockPrisma.progressEvaluation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              playerId: 'player-1',
              teamSeasonCategoryId: 'cat-u15',
              seasonId: 'season-team-2026',
              evaluatorStaffId: teacherStaff.id,
            }),
          }),
        );
        expect(created.canEdit).toBe(true);
      });

      it('should reject foreign participant not enrolled in the Course shift', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.courseSeasonShift.findUnique.mockResolvedValueOnce({
          id: 'shift-1',
          courseSeason: { seasonId: 'season-2026' },
        });

        // Estudiante NO pertenece
        mockPrisma.cycleEnrollment.findFirst.mockResolvedValueOnce(null);
        mockPrisma.studentMembership.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.createGroupEvaluation(teacherUser, 'COURSE', 'shift-1', {
            participantId: 'student-foreign',
            evaluationDate: new Date(),
          }),
        ).rejects.toThrow(
          new BadRequestException(
            'El estudiante especificado no pertenece a este turno de curso.',
          ),
        );
      });

      it('should reject foreign player not member of the Team category', async () => {
        mockPrisma.teamSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'tss-1',
          staffId: teacherStaff.id,
          teamSeasonCategoryId: 'cat-u15',
        });

        mockPrisma.teamSeasonCategory.findUnique.mockResolvedValueOnce({
          id: 'cat-u15',
          teamSeason: { seasonId: 'season-team-2026' },
        });

        // Jugador NO pertenece
        mockPrisma.playerMembership.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.createGroupEvaluation(teacherUser, 'TEAM', 'cat-u15', {
            participantId: 'player-foreign',
            evaluationDate: new Date(),
          }),
        ).rejects.toThrow(
          new BadRequestException(
            'El jugador especificado no pertenece a esta categoría de equipo.',
          ),
        );
      });

      it('should allow same staff to evaluate same participant in multiple distinct groups', async () => {
        // Staff asignado a turno A y turno B
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({
          id: 'css-assigned',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-any',
        });

        mockPrisma.courseSeasonShift.findUnique
          .mockResolvedValueOnce({
            id: 'shift-A',
            courseSeason: { seasonId: 'season-2026' },
          })
          .mockResolvedValueOnce({
            id: 'shift-B',
            courseSeason: { seasonId: 'season-2026' },
          });

        mockPrisma.cycleEnrollment.findFirst.mockResolvedValue({ id: 'enr-ok' });

        mockPrisma.progressEvaluation.create
          .mockResolvedValueOnce({
            id: 'eval-shift-A',
            studentId: 'student-multi',
            courseSeasonShiftId: 'shift-A',
            seasonId: 'season-2026',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date(),
            student: { person: { name: 'Multi', lastName: 'Student' } },
            evaluatorStaff: { person: { name: 'Carlos', lastName: 'Mendoza' } },
          })
          .mockResolvedValueOnce({
            id: 'eval-shift-B',
            studentId: 'student-multi',
            courseSeasonShiftId: 'shift-B',
            seasonId: 'season-2026',
            evaluatorStaffId: teacherStaff.id,
            evaluationDate: new Date(),
            student: { person: { name: 'Multi', lastName: 'Student' } },
            evaluatorStaff: { person: { name: 'Carlos', lastName: 'Mendoza' } },
          });

        const evalA = await service.createGroupEvaluation(
          teacherUser,
          'COURSE',
          'shift-A',
          { participantId: 'student-multi', evaluationDate: new Date() },
        );
        const evalB = await service.createGroupEvaluation(
          teacherUser,
          'COURSE',
          'shift-B',
          { participantId: 'student-multi', evaluationDate: new Date() },
        );

        expect(evalA.id).toBe('eval-shift-A');
        expect(evalB.id).toBe('eval-shift-B');
      });
    });

    describe('updateGroupEvaluation', () => {
      it('should throw ForbiddenException if user lacks UPDATE_PROGRESS_EVALUATIONS', async () => {
        await expect(
          service.updateGroupEvaluation(
            { id: 'user-1', personId: 'p-1', permissions: ['READ_PROGRESS_EVALUATIONS'] },
            'COURSE',
            'shift-1',
            'eval-1',
            { notes: 'Nueva nota' },
          ),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should throw NotFoundException if evaluation does not exist', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce(null);

        await expect(
          service.updateGroupEvaluation(
            teacherUser,
            'COURSE',
            'shift-1',
            'non-existent-eval',
            { notes: 'Nueva nota' },
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if evaluation does not belong to the target group', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce({
          id: 'eval-other-group',
          courseSeasonShiftId: 'shift-2', // Pertenece a shift-2, no shift-1
          evaluatorStaffId: teacherStaff.id,
        });

        await expect(
          service.updateGroupEvaluation(
            teacherUser,
            'COURSE',
            'shift-1',
            'eval-other-group',
            { notes: 'Nueva nota' },
          ),
        ).rejects.toThrow(
          new BadRequestException(
            'La evaluación no pertenece a este turno de curso.',
          ),
        );
      });

      it('should enforce ownership: throw ForbiddenException if evaluation was created by another staff', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce({
          id: 'eval-by-other-staff',
          courseSeasonShiftId: 'shift-1',
          evaluatorStaffId: otherTeacherStaff.id, // Creada por otro docente!
        });

        await expect(
          service.updateGroupEvaluation(
            teacherUser,
            'COURSE',
            'shift-1',
            'eval-by-other-staff',
            { notes: 'Intento de modificar' },
          ),
        ).rejects.toThrow(
          new ForbiddenException(
            'No tienes autorización para modificar una evaluación creada por otro docente o entrenador.',
          ),
        );
      });

      it('should successfully update scores and notes when caller is the original author', async () => {
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValueOnce({
          id: 'css-1',
          staffId: teacherStaff.id,
          courseSeasonShiftId: 'shift-1',
        });

        mockPrisma.progressEvaluation.findUnique.mockResolvedValueOnce({
          id: 'eval-mine',
          courseSeasonShiftId: 'shift-1',
          studentId: 'student-1',
          evaluatorStaffId: teacherStaff.id, // Autor original es teacherStaff
        });

        mockPrisma.progressEvaluation.update.mockResolvedValueOnce({
          id: 'eval-mine',
          courseSeasonShiftId: 'shift-1',
          studentId: 'student-1',
          evaluatorStaffId: teacherStaff.id,
          evaluationDate: new Date('2026-07-20'),
          technicalScore: 95,
          tacticalScore: 92,
          physicalScore: 88,
          behaviorScore: 98,
          notes: 'Progreso excelente actualizado',
          student: { person: { name: 'Juan', lastName: 'Perez' } },
          evaluatorStaff: { person: { name: 'Carlos', lastName: 'Mendoza' } },
        });

        const updated = await service.updateGroupEvaluation(
          teacherUser,
          'COURSE',
          'shift-1',
          'eval-mine',
          {
            technicalScore: 95,
            notes: 'Progreso excelente actualizado',
          },
        );

        expect(mockPrisma.progressEvaluation.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'eval-mine' },
            data: expect.objectContaining({
              technicalScore: 95,
              notes: 'Progreso excelente actualizado',
            }),
          }),
        );
        expect(updated.technicalScore).toBe(95);
        expect(updated.canEdit).toBe(true);
      });
    });
  });

  describe('Phase F: Sessions + Incidents Operation & Resource Authorization', () => {
    const teacherUser = {
      id: 'user-teacher-1',
      email: 'teacher@can.edu.bo',
      personId: 'person-1',
      permissions: [
        'CREATE_SESSIONS',
        'READ_SESSIONS',
        'UPDATE_SESSIONS',
        'CREATE_SESSION_INCIDENTS',
        'READ_SESSION_INCIDENTS',
        'UPDATE_SESSION_INCIDENTS',
      ],
    };

    describe('createGroupSession', () => {
      it('should reject invalid group type with BadRequestException', async () => {
        await expect(
          service.createGroupSession(teacherUser, 'INVALID', 'shift-1', {
            startDate: '2026-10-20T17:00:00.000Z',
            endDate: '2026-10-20T18:30:00.000Z',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject if endDate <= startDate with BadRequestException', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        await expect(
          service.createGroupSession(teacherUser, 'COURSE', 'shift-1', {
            startDate: '2026-10-20T19:00:00.000Z',
            endDate: '2026-10-20T18:00:00.000Z',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should successfully create session with group relation strictly server-derived', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockSessionsService.create.mockResolvedValue({
          data: { id: 'session-new-1' },
        });

        mockPrisma.session.findUnique.mockResolvedValue({
          id: 'session-new-1',
          durationMin: 90,
          event: {
            id: 'event-1',
            title: 'Entrenamiento Táctico',
            startDate: new Date('2026-10-20T17:00:00.000Z'),
            endDate: new Date('2026-10-20T18:30:00.000Z'),
            status: 'SCHEDULED',
            location: { id: 'loc-1', name: 'Cancha Central', address: 'Costanera' },
          },
        });

        const result = await service.createGroupSession(teacherUser, 'COURSE', 'shift-1', {
          title: 'Entrenamiento Táctico',
          startDate: '2026-10-20T17:00:00.000Z',
          endDate: '2026-10-20T18:30:00.000Z',
          durationMin: 90,
        });

        expect(mockSessionsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            courseSeasonShiftIds: ['shift-1'],
            teamSeasonCategoryIds: undefined,
          }),
          teacherUser.id,
        );
        expect(result.id).toBe('session-new-1');
        expect(result.status).toBe('SCHEDULED');
      });
    });

    describe('updateGroupSession', () => {
      it('should throw BadRequestException if session has bookings and caller tries to change startDate', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockPrisma.sessionCourse.findUnique.mockResolvedValue({
          session: {
            id: 'session-1',
            eventId: 'event-1',
            durationMin: 90,
            event: {
              id: 'event-1',
              startDate: new Date('2026-10-20T17:00:00.000Z'),
              endDate: new Date('2026-10-20T18:30:00.000Z'),
              status: 'SCHEDULED',
              location: null,
            },
            _count: { bookings: 5 },
          },
        });

        await expect(
          service.updateGroupSession(teacherUser, 'COURSE', 'shift-1', 'session-1', {
            startDate: '2026-10-22T17:00:00.000Z',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should allow updating title and location and cancel session', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockPrisma.sessionCourse.findUnique.mockResolvedValue({
          session: {
            id: 'session-1',
            eventId: 'event-1',
            durationMin: 90,
            event: {
              id: 'event-1',
              startDate: new Date('2026-10-20T17:00:00.000Z'),
              endDate: new Date('2026-10-20T18:30:00.000Z'),
              status: 'SCHEDULED',
              location: null,
            },
            _count: { bookings: 0 },
          },
        });

        mockPrisma.$transaction.mockImplementation(async (cb: any) => {
          return cb(mockPrisma);
        });

        mockPrisma.session.findUnique.mockResolvedValue({
          id: 'session-1',
          durationMin: 90,
          event: {
            id: 'event-1',
            title: 'Título Nuevo',
            startDate: new Date('2026-10-20T17:00:00.000Z'),
            endDate: new Date('2026-10-20T18:30:00.000Z'),
            status: 'CANCELLED',
            location: null,
          },
        });

        const result = await service.cancelGroupSession(teacherUser, 'COURSE', 'shift-1', 'session-1');
        expect(result.status).toBe('CANCELLED');
      });
    });

    describe('Incidents Resource Authorization', () => {
      it('should reject creating incident if participant does not belong to group', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockPrisma.sessionCourse.findUnique.mockResolvedValue({
          session: {
            id: 'session-1',
            eventId: 'event-1',
            durationMin: 90,
            event: {
              id: 'event-1',
              startDate: new Date('2026-10-20T17:00:00.000Z'),
              endDate: new Date('2026-10-20T18:30:00.000Z'),
              status: 'SCHEDULED',
              location: null,
            },
            _count: { bookings: 0 },
          },
        });

        // Participant has no cycle enrollment, membership, or booking
        mockPrisma.cycleEnrollment.findFirst.mockResolvedValue(null);
        mockPrisma.studentMembership.findFirst.mockResolvedValue(null);
        mockPrisma.sessionBooking.findFirst.mockResolvedValue(null);

        await expect(
          service.createGroupSessionIncident(teacherUser, 'COURSE', 'shift-1', 'session-1', {
            participantId: 'student-foreign',
            description: 'Llegó tarde',
          }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('should create incident successfully and link to session booking', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockPrisma.sessionCourse.findUnique.mockResolvedValue({
          session: {
            id: 'session-1',
            eventId: 'event-1',
            durationMin: 90,
            event: {
              id: 'event-1',
              startDate: new Date('2026-10-20T17:00:00.000Z'),
              endDate: new Date('2026-10-20T18:30:00.000Z'),
              status: 'SCHEDULED',
              location: null,
            },
            _count: { bookings: 1 },
          },
        });

        mockPrisma.cycleEnrollment.findFirst.mockResolvedValue({ id: 'enroll-1' });
        mockPrisma.sessionBooking.findFirst.mockResolvedValue({ id: 'booking-1' });
        mockPrisma.sessionIncident.create.mockResolvedValue({
          id: 'incident-1',
          sessionBookingId: 'booking-1',
          description: 'Actitud desafiante',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdById: teacherUser.id,
          sessionBooking: {
            studentId: 'student-1',
            student: {
              person: { name: 'Juan', lastName: 'Perez' },
            },
          },
          createdBy: {
            id: teacherUser.id,
            email: teacherUser.email,
            person: { name: 'Profesor', lastName: 'CAN' },
          },
        });

        const inc = await service.createGroupSessionIncident(teacherUser, 'COURSE', 'shift-1', 'session-1', {
          participantId: 'student-1',
          description: 'Actitud desafiante',
        });

        expect(inc.id).toBe('incident-1');
        expect(inc.description).toBe('Actitud desafiante');
        expect(inc.canEdit).toBe(true);
      });

      it('should reject updating incident if user is not author and not admin', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ personId: 'person-1' });
        mockPrisma.staff.findUnique.mockResolvedValue(mockStaff);
        mockPrisma.courseSeasonStaff.findFirst.mockResolvedValue({ id: 'ass-1' });

        mockPrisma.sessionCourse.findUnique.mockResolvedValue({
          session: {
            id: 'session-1',
            eventId: 'event-1',
            durationMin: 90,
            event: {
              id: 'event-1',
              startDate: new Date('2026-10-20T17:00:00.000Z'),
              endDate: new Date('2026-10-20T18:30:00.000Z'),
              status: 'SCHEDULED',
              location: null,
            },
            _count: { bookings: 1 },
          },
        });

        mockPrisma.sessionIncident.findUnique.mockResolvedValue({
          id: 'incident-other',
          createdById: 'user-other-coach',
          sessionBooking: { sessionId: 'session-1' },
        });

        await expect(
          service.updateGroupSessionIncident(teacherUser, 'COURSE', 'shift-1', 'session-1', 'incident-other', {
            description: 'Intento de edición no autorizado',
          }),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});


