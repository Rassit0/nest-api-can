import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  MyGroupsResponseDto,
  TeacherGroupDto,
  TeacherGroupType,
} from './dto/my-groups-response.dto';
import { StaffContextResponseDto } from './dto/staff-context-response.dto';
import {
  TeacherDashboardResponseDto,
  TeacherDashboardStatsDto,
  UpcomingSessionDto,
} from './dto/teacher-dashboard-response.dto';
import {
  TeacherGroupContextResponseDto,
  TeacherParticipantDto,
  TeacherGroupSessionDto,
} from './dto/teacher-group-context-response.dto';
import {
  SessionAttendanceRosterResponseDto,
  AttendanceParticipantDto,
} from './dto/session-attendance-roster-response.dto';
import {
  BulkAttendanceDto,
  BulkAttendanceResponseDto,
} from './dto/bulk-attendance.dto';
import {
  TeacherCreateEvaluationDto,
  TeacherUpdateEvaluationDto,
  TeacherEvaluationItemDto,
  TeacherGroupEvaluationsResponseDto,
} from './dto/teacher-evaluation.dto';
import {
  TeacherCreateSessionDto,
  TeacherUpdateSessionDto,
  TeacherSessionDetailDto,
} from './dto/teacher-session.dto';
import {
  TeacherCreateIncidentDto,
  TeacherUpdateIncidentDto,
  TeacherIncidentItemDto,
  TeacherSessionIncidentsResponseDto,
} from './dto/teacher-incident.dto';
import { SessionsService } from 'src/sessions/sessions.service';
import { CreateSessionDto } from 'src/sessions/dto/create-session.dto';

export interface AuthenticatedUserContext {
  id: string;
  email?: string;
  roleId?: string;
  personId?: string | null;
  permissions?: string[];
  [key: string]: any;
}

@Injectable()
export class StaffAccessService {
  private readonly logger = new Logger(StaffAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Resuelve el perfil de Staff activo para el usuario autenticado.
   * Valida la cadena User -> Person -> Staff.
   */
  async resolveCurrentStaff(user: AuthenticatedUserContext) {
    if (!user || !user.id) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    let personId = user.personId;

    // Si personId no vino en el token o context, resolvemos desde la base de datos
    if (!personId) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { personId: true },
      });
      personId = dbUser?.personId;
    }

    if (!personId) {
      throw new ForbiddenException(
        'El usuario autenticado no tiene un perfil de persona asociado.',
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { personId },
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

    if (!staff) {
      throw new ForbiddenException(
        'La persona asociada no está registrada como personal del club.',
      );
    }

    if (!staff.isActive) {
      throw new ForbiddenException('El perfil de personal se encuentra inactivo.');
    }

    return staff;
  }

  /**
   * Obtiene el contexto de Staff del usuario autenticado sin lanzar 403.
   * Usado por el Launcher y guards de navegación para saber si el usuario es personal activo.
   */
  async getStaffContext(
    user: AuthenticatedUserContext,
  ): Promise<StaffContextResponseDto> {
    if (!user || !user.id) {
      return {
        isStaff: false,
        staffId: null,
        hasAssignments: false,
        activeGroupsCount: 0,
      };
    }

    let personId = user.personId;
    if (!personId) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { personId: true },
      });
      personId = dbUser?.personId;
    }

    if (!personId) {
      return {
        isStaff: false,
        staffId: null,
        hasAssignments: false,
        activeGroupsCount: 0,
      };
    }

    const staff = await this.prisma.staff.findUnique({
      where: { personId },
      select: { id: true, isActive: true },
    });

    if (!staff || !staff.isActive) {
      return {
        isStaff: false,
        staffId: null,
        hasAssignments: false,
        activeGroupsCount: 0,
      };
    }

    const now = new Date();
    const courseAssignmentsCount = await this.prisma.courseSeasonStaff.count({
      where: {
        staffId: staff.id,
        startedAt: { lte: now },
        OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      },
    });

    const teamAssignmentsCount = await this.prisma.teamSeasonStaff.count({
      where: {
        staffId: staff.id,
        startedAt: { lte: now },
        OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      },
    });

    const activeGroupsCount = courseAssignmentsCount + teamAssignmentsCount;

    return {
      isStaff: true,
      staffId: staff.id,
      hasAssignments: activeGroupsCount > 0,
      activeGroupsCount,
    };
  }

  /**
   * Obtiene la lista unificada de grupos (turnos de escuelas y categorías de equipos)
   * donde el usuario autenticado tiene asignación de Staff activa.
   */
  async getMyGroups(
    user: AuthenticatedUserContext,
  ): Promise<MyGroupsResponseDto> {
    const staff = await this.resolveCurrentStaff(user);
    const now = new Date();

    // 1. Asignaciones activas de Cursos Escolares (CourseSeasonShift)
    const courseStaffAssignments =
      await this.prisma.courseSeasonStaff.findMany({
        where: {
          staffId: staff.id,
          startedAt: { lte: now },
          OR: [{ endedAt: null }, { endedAt: { gt: now } }],
        },
        include: {
          courseSeasonShift: {
            include: {
              shift: {
                select: {
                  id: true,
                  name: true,
                },
              },
              category: { select: { id: true, name: true } },
              courseSeason: {
                include: {
                  course: {
                    select: { id: true, name: true, imageUrl: true },
                  },
                  season: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

    // 2. Asignaciones activas de Equipos Deportivos (TeamSeasonCategory)
    const teamStaffAssignments = await this.prisma.teamSeasonStaff.findMany({
      where: {
        staffId: staff.id,
        startedAt: { lte: now },
        OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      },
      include: {
        teamSeasonCategory: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                minAge: true,
                maxAge: true,
              },
            },
            teamSeason: {
              include: {
                team: {
                  select: { id: true, name: true, imageUrl: true },
                },
                season: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // 3. Contadores eficientes agrupados (evitando N+1 queries)
    const courseShiftIds = courseStaffAssignments.map(
      (a) => a.courseSeasonShiftId,
    );
    const teamCategoryIds = teamStaffAssignments.map(
      (a) => a.teamSeasonCategoryId,
    );

    const adminCourseCountMap = new Map<string, number>();
    const activeCycleCountMap = new Map<string, number>();
    const activeTeamPlayerCountMap = new Map<string, number>();

    if (courseShiftIds.length > 0) {
      // Total de membresías administrativas activas
      const adminCounts = await this.prisma.studentMembership.groupBy({
        by: ['courseSeasonShiftId'],
        where: {
          courseSeasonShiftId: { in: courseShiftIds },
          status: 'ACTIVE',
        },
        _count: { id: true },
      });
      for (const item of adminCounts) {
        adminCourseCountMap.set(item.courseSeasonShiftId, item._count.id);
      }

      // Participantes con ciclo mensual vigente y confirmado
      const cycleCounts = await this.prisma.cycleEnrollment.groupBy({
        by: ['courseSeasonShiftId'],
        where: {
          courseSeasonShiftId: { in: courseShiftIds },
          status: { in: ['PENDING', 'CONFIRMED'] },
          effectiveStartDate: { lte: now },
          cycleEndDate: { gt: now },
          studentMembership: { status: 'ACTIVE' },
        },
        _count: { id: true },
      });
      for (const item of cycleCounts) {
        activeCycleCountMap.set(item.courseSeasonShiftId, item._count.id);
      }
    }

    if (teamCategoryIds.length > 0) {
      // Total de jugadores con membresía deportiva activa
      const teamCounts = await this.prisma.playerMembership.groupBy({
        by: ['teamSeasonCategoryId'],
        where: {
          teamSeasonCategoryId: { in: teamCategoryIds },
          status: 'ACTIVE',
          startedAt: { lte: now },
          OR: [{ endedAt: null }, { endedAt: { gt: now } }],
        },
        _count: { id: true },
      });
      for (const item of teamCounts) {
        activeTeamPlayerCountMap.set(item.teamSeasonCategoryId, item._count.id);
      }
    }

    // 4. Mapeo a la estructura unificada TeacherGroupDto
    const courseGroups: TeacherGroupDto[] = courseStaffAssignments.map(
      (assignment) => {
        const shift = assignment.courseSeasonShift;
        const course = shift.courseSeason.course;
        const shiftName = shift.shift?.name || 'Turno';
        const categoryName = shift.category?.name || 'General';

        return {
          type: 'COURSE' as TeacherGroupType,
          groupId: shift.id,
          parentId: shift.courseSeasonId,
          name: course.name,
          detail: `${shiftName} (${categoryName})`,
          category: categoryName,
          shift: shiftName,
          gender: shift.gender,
          role: assignment.role,
          customRole: assignment.customRole,
          isPrimary: assignment.isPrimary,
          participantCount: activeCycleCountMap.get(shift.id) || 0,
          administrativeCount: adminCourseCountMap.get(shift.id) || 0,
          startedAt: assignment.startedAt,
          endedAt: assignment.endedAt,
        };
      },
    );

    const teamGroups: TeacherGroupDto[] = teamStaffAssignments.map(
      (assignment) => {
        const teamCat = assignment.teamSeasonCategory;
        const team = teamCat.teamSeason.team;
        const categoryName = teamCat.category?.name || 'General';
        const genderSuffix = teamCat.gender ? ` (${teamCat.gender})` : '';

        return {
          type: 'TEAM' as TeacherGroupType,
          groupId: teamCat.id,
          parentId: teamCat.teamSeasonId,
          name: team.name,
          detail: `Categoría ${categoryName}${genderSuffix}`,
          category: categoryName,
          shift: null,
          gender: teamCat.gender,
          role: assignment.role,
          customRole: assignment.customRole,
          isPrimary: assignment.isPrimary,
          participantCount: activeTeamPlayerCountMap.get(teamCat.id) || 0,
          administrativeCount: activeTeamPlayerCountMap.get(teamCat.id) || 0,
          startedAt: assignment.startedAt,
          endedAt: assignment.endedAt,
        };
      },
    );

    return {
      staffId: staff.id,
      person: staff.person,
      groups: [...courseGroups, ...teamGroups],
    };
  }

  /**
   * Obtiene la agregación del dashboard para el profesor/entrenador autenticado.
   * Incluye KPIs personales, lista de grupos asignados y próximas sesiones (adaptativo por permisos).
   */
  async getTeacherDashboard(
    user: AuthenticatedUserContext,
  ): Promise<TeacherDashboardResponseDto> {
    const myGroupsData = await this.getMyGroups(user);
    const groups = myGroupsData.groups;

    const stats: TeacherDashboardStatsDto = {
      activeGroups: groups.length,
      courseGroups: groups.filter((g) => g.type === 'COURSE').length,
      teamGroups: groups.filter((g) => g.type === 'TEAM').length,
      currentParticipants: groups.reduce(
        (acc, g) => acc + (g.participantCount || 0),
        0,
      ),
      administrativeParticipants: groups.reduce(
        (acc, g) => acc + (g.administrativeCount || 0),
        0,
      ),
    };

    const userPermissions: string[] = user.permissions || [];
    const hasReadSessions = userPermissions.includes('READ_SESSIONS');

    let upcomingSessions: UpcomingSessionDto[] | undefined = undefined;

    if (hasReadSessions) {
      const courseShiftIds = groups
        .filter((g) => g.type === 'COURSE')
        .map((g) => g.groupId);
      const teamCategoryIds = groups
        .filter((g) => g.type === 'TEAM')
        .map((g) => g.groupId);

      if (courseShiftIds.length === 0 && teamCategoryIds.length === 0) {
        upcomingSessions = [];
        stats.upcomingSessionsCount = 0;
      } else {
        const now = new Date();
        const orConditions: any[] = [];
        if (courseShiftIds.length > 0) {
          orConditions.push({
            sessionCourses: {
              some: {
                courseSeasonShiftId: { in: courseShiftIds },
              },
            },
          });
        }
        if (teamCategoryIds.length > 0) {
          orConditions.push({
            sessionTeams: {
              some: {
                teamSeasonCategoryId: { in: teamCategoryIds },
              },
            },
          });
        }

        const sessions = await this.prisma.session.findMany({
          where: {
            event: {
              startDate: { gte: now },
              status: { not: 'CANCELLED' },
            },
            OR: orConditions,
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                location: {
                  select: {
                    id: true,
                    name: true,
                    address: true,
                  },
                },
              },
            },
            sessionCourses: {
              where: {
                courseSeasonShiftId: { in: courseShiftIds },
              },
              include: {
                courseSeasonShift: {
                  include: {
                    shift: { select: { id: true, name: true } },
                    category: { select: { id: true, name: true } },
                    courseSeason: {
                      include: {
                        course: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
            sessionTeams: {
              where: {
                teamSeasonCategoryId: { in: teamCategoryIds },
              },
              include: {
                teamSeasonCategory: {
                  include: {
                    category: { select: { id: true, name: true } },
                    teamSeason: {
                      include: {
                        team: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            event: {
              startDate: 'asc',
            },
          },
          take: 5,
        });

        upcomingSessions = sessions.map((s) => {
          let groupType: TeacherGroupType = 'COURSE';
          let groupId = '';
          let groupName = '';
          let groupDetail = '';

          if (s.sessionCourses && s.sessionCourses.length > 0) {
            const sc = s.sessionCourses[0];
            groupType = 'COURSE';
            groupId = sc.courseSeasonShiftId;
            groupName = sc.courseSeasonShift.courseSeason.course.name;
            const shiftName = sc.courseSeasonShift.shift?.name || 'Turno';
            const catName = sc.courseSeasonShift.category?.name || 'General';
            groupDetail = `${shiftName} (${catName})`;
          } else if (s.sessionTeams && s.sessionTeams.length > 0) {
            const st = s.sessionTeams[0];
            groupType = 'TEAM';
            groupId = st.teamSeasonCategoryId;
            groupName = st.teamSeasonCategory.teamSeason.team.name;
            const catName = st.teamSeasonCategory.category?.name || 'General';
            const genderSuffix = st.teamSeasonCategory.gender ? ` (${st.teamSeasonCategory.gender})` : '';
            groupDetail = `Categoría ${catName}${genderSuffix}`;
          }

          const durationMin = s.durationMin || 90;
          const startDate = s.event.startDate;
          const endDate =
            s.event.endDate || new Date(startDate.getTime() + durationMin * 60000);

          return {
            id: s.id,
            title: s.event.title || groupName || 'Sesión de entrenamiento',
            startDate,
            endDate,
            durationMin,
            location: s.event.location
              ? {
                  id: s.event.location.id,
                  name: s.event.location.name,
                  address: s.event.location.address,
                }
              : null,
            groupType,
            groupId,
            groupName,
            groupDetail,
          };
        });

        stats.upcomingSessionsCount = upcomingSessions.length;
      }
    }

    return {
      staffId: myGroupsData.staffId,
      person: myGroupsData.person,
      stats,
      groups,
      upcomingSessions,
    };
  }

  /**
   * Obtiene el contexto seguro de un grupo específico asignado al profesor.
   * Ejecuta aserción de seguridad de recurso según tipo COURSE o TEAM.
   * Retorna metadatos del grupo, roster canónico de participantes y sesiones (adaptativo por permisos).
   */
  async getGroupContext(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
  ): Promise<TeacherGroupContextResponseDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    const now = new Date();
    const userPermissions: string[] = user.permissions || [];
    const hasReadSessions = userPermissions.includes('READ_SESSIONS');

    if (normalizedType === 'COURSE') {
      // 1. Aserción de recurso estricta
      const { staff, assignment } = await this.assertCourseSeasonShiftAccess(
        user,
        groupId,
      );

      // 2. Metadatos del grupo
      const shift = await this.prisma.courseSeasonShift.findUnique({
        where: { id: groupId },
        include: {
          shift: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          courseSeason: {
            include: {
              course: { select: { id: true, name: true, imageUrl: true } },
              season: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!shift) {
        throw new NotFoundException('Turno de curso escolar no encontrado.');
      }

      const course = shift.courseSeason.course;
      const shiftName = shift.shift?.name || 'Turno';
      const categoryName = shift.category?.name || 'General';

      // 3. Participantes canónicos (adaptativo por permisos: READ_STUDENTS o READ_SESSION_BOOKINGS)
      const canReadParticipants =
        userPermissions.includes('READ_STUDENTS') ||
        userPermissions.includes('READ_SESSION_BOOKINGS');

      let participants: TeacherParticipantDto[] | undefined = undefined;

      if (canReadParticipants) {
        const enrollments = await this.prisma.cycleEnrollment.findMany({
          where: {
            courseSeasonShiftId: groupId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            effectiveStartDate: { lte: now },
            cycleEndDate: { gt: now },
            studentMembership: { status: 'ACTIVE' },
          },
          include: {
            studentMembership: {
              include: {
                student: {
                  include: {
                    person: {
                      select: {
                        id: true,
                        name: true,
                        lastName: true,
                        secondLastName: true,
                        imageUrl: true,
                        documentNumber: true,
                        birthDate: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { studentMembership: { student: { person: { lastName: 'asc' } } } },
            { studentMembership: { student: { person: { name: 'asc' } } } },
          ],
        });

        participants = enrollments.map((e) => {
          const person = e.studentMembership.student.person;
          return {
            type: 'STUDENT',
            participantId: e.studentMembership.student.id,
            personId: person.id,
            firstName: person.name,
            lastName: person.lastName,
            secondLastName: person.secondLastName,
            membershipId: e.studentMembership.id,
            imageUrl: person.imageUrl,
            status: e.status,
            documentNumber: person.documentNumber,
            birthDate: person.birthDate,
          };
        });
      }

      // Conteo canónico de participantes activos en el ciclo
      const participantCount =
        participants !== undefined
          ? participants.length
          : await this.prisma.cycleEnrollment.count({
              where: {
                courseSeasonShiftId: groupId,
                status: { in: ['PENDING', 'CONFIRMED'] },
                effectiveStartDate: { lte: now },
                cycleEndDate: { gt: now },
                studentMembership: { status: 'ACTIVE' },
              },
            });

      // Conteo de inscripciones administrativas activas
      const administrativeCount = await this.prisma.studentMembership.count({
        where: {
          courseSeasonShiftId: groupId,
          status: 'ACTIVE',
        },
      });

      // 4. Sesiones (adaptativo por permiso: READ_SESSIONS)
      let upcomingSessions: TeacherGroupSessionDto[] | undefined = undefined;
      let recentSessions: TeacherGroupSessionDto[] | undefined = undefined;

      if (hasReadSessions) {
        const upcomingList = await this.prisma.session.findMany({
          where: {
            sessionCourses: { some: { courseSeasonShiftId: groupId } },
            event: {
              startDate: { gte: now },
              status: { not: 'CANCELLED' },
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                status: true,
                location: {
                  select: { id: true, name: true, address: true },
                },
              },
            },
          },
          orderBy: { event: { startDate: 'asc' } },
          take: 5,
        });

        upcomingSessions = upcomingList.map((s) => ({
          id: s.id,
          eventId: s.event.id,
          title: s.event.title || course.name,
          startDate: s.event.startDate,
          endDate:
            s.event.endDate ||
            new Date(s.event.startDate.getTime() + (s.durationMin || 90) * 60000),
          durationMin: s.durationMin || 90,
          location: s.event.location
            ? {
                id: s.event.location.id,
                name: s.event.location.name,
                address: s.event.location.address,
              }
            : null,
          status: s.event.status,
        }));

        const recentList = await this.prisma.session.findMany({
          where: {
            sessionCourses: { some: { courseSeasonShiftId: groupId } },
            event: {
              startDate: { lt: now },
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                status: true,
                location: {
                  select: { id: true, name: true, address: true },
                },
              },
            },
          },
          orderBy: { event: { startDate: 'desc' } },
          take: 5,
        });

        recentSessions = recentList.map((s) => ({
          id: s.id,
          eventId: s.event.id,
          title: s.event.title || course.name,
          startDate: s.event.startDate,
          endDate:
            s.event.endDate ||
            new Date(s.event.startDate.getTime() + (s.durationMin || 90) * 60000),
          durationMin: s.durationMin || 90,
          location: s.event.location
            ? {
                id: s.event.location.id,
                name: s.event.location.name,
                address: s.event.location.address,
              }
            : null,
          status: s.event.status,
        }));
      }

      return {
        type: 'COURSE',
        id: groupId,
        parentId: shift.courseSeasonId,
        name: course.name,
        detail: `${shiftName} (${categoryName})`,
        category: categoryName,
        shift: shiftName,
        gender: shift.gender,
        role: assignment.role,
        customRole: assignment.customRole,
        isPrimary: assignment.isPrimary,
        participantCount,
        administrativeCount,
        course: {
          courseSeasonId: shift.courseSeasonId,
          courseId: course.id,
          shiftId: shift.shiftId,
          shiftName,
        },
        team: null,
        participants,
        upcomingSessions,
        recentSessions,
      };
    } else {
      // 1. Aserción de recurso estricta para TEAM
      const { staff, assignment } = await this.assertTeamSeasonCategoryAccess(
        user,
        groupId,
      );

      // 2. Metadatos del grupo
      const teamCat = await this.prisma.teamSeasonCategory.findUnique({
        where: { id: groupId },
        include: {
          category: { select: { id: true, name: true } },
          teamSeason: {
            include: {
              team: { select: { id: true, name: true, imageUrl: true } },
              season: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!teamCat) {
        throw new NotFoundException('Categoría de equipo no encontrada.');
      }

      const team = teamCat.teamSeason.team;
      const categoryName = teamCat.category?.name || 'General';
      const genderSuffix = teamCat.gender ? ` (${teamCat.gender})` : '';

      // 3. Participantes canónicos (adaptativo por permisos: READ_PLAYERS o READ_SESSION_BOOKINGS)
      const canReadParticipants =
        userPermissions.includes('READ_PLAYERS') ||
        userPermissions.includes('READ_SESSION_BOOKINGS');

      let participants: TeacherParticipantDto[] | undefined = undefined;

      if (canReadParticipants) {
        const memberships = await this.prisma.playerMembership.findMany({
          where: {
            teamSeasonCategoryId: groupId,
            status: 'ACTIVE',
            startedAt: { lte: now },
            OR: [{ endedAt: null }, { endedAt: { gt: now } }],
          },
          include: {
            player: {
              include: {
                person: {
                  select: {
                    id: true,
                    name: true,
                    lastName: true,
                    secondLastName: true,
                    imageUrl: true,
                    documentNumber: true,
                    birthDate: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { player: { person: { lastName: 'asc' } } },
            { player: { person: { name: 'asc' } } },
          ],
        });

        participants = memberships.map((m) => {
          const person = m.player.person;
          return {
            type: 'PLAYER',
            participantId: m.player.id,
            personId: person.id,
            firstName: person.name,
            lastName: person.lastName,
            secondLastName: person.secondLastName,
            membershipId: m.id,
            imageUrl: person.imageUrl,
            status: m.status,
            documentNumber: person.documentNumber,
            birthDate: person.birthDate,
          };
        });
      }

      // Conteo de jugadores activos
      const participantCount =
        participants !== undefined
          ? participants.length
          : await this.prisma.playerMembership.count({
              where: {
                teamSeasonCategoryId: groupId,
                status: 'ACTIVE',
                startedAt: { lte: now },
                OR: [{ endedAt: null }, { endedAt: { gt: now } }],
              },
            });

      // 4. Sesiones (adaptativo por permiso: READ_SESSIONS)
      let upcomingSessions: TeacherGroupSessionDto[] | undefined = undefined;
      let recentSessions: TeacherGroupSessionDto[] | undefined = undefined;

      if (hasReadSessions) {
        const upcomingList = await this.prisma.session.findMany({
          where: {
            sessionTeams: { some: { teamSeasonCategoryId: groupId } },
            event: {
              startDate: { gte: now },
              status: { not: 'CANCELLED' },
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                status: true,
                location: {
                  select: { id: true, name: true, address: true },
                },
              },
            },
          },
          orderBy: { event: { startDate: 'asc' } },
          take: 5,
        });

        upcomingSessions = upcomingList.map((s) => ({
          id: s.id,
          eventId: s.event.id,
          title: s.event.title || team.name,
          startDate: s.event.startDate,
          endDate:
            s.event.endDate ||
            new Date(s.event.startDate.getTime() + (s.durationMin || 90) * 60000),
          durationMin: s.durationMin || 90,
          location: s.event.location
            ? {
                id: s.event.location.id,
                name: s.event.location.name,
                address: s.event.location.address,
              }
            : null,
          status: s.event.status,
        }));

        const recentList = await this.prisma.session.findMany({
          where: {
            sessionTeams: { some: { teamSeasonCategoryId: groupId } },
            event: {
              startDate: { lt: now },
            },
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
                status: true,
                location: {
                  select: { id: true, name: true, address: true },
                },
              },
            },
          },
          orderBy: { event: { startDate: 'desc' } },
          take: 5,
        });

        recentSessions = recentList.map((s) => ({
          id: s.id,
          eventId: s.event.id,
          title: s.event.title || team.name,
          startDate: s.event.startDate,
          endDate:
            s.event.endDate ||
            new Date(s.event.startDate.getTime() + (s.durationMin || 90) * 60000),
          durationMin: s.durationMin || 90,
          location: s.event.location
            ? {
                id: s.event.location.id,
                name: s.event.location.name,
                address: s.event.location.address,
              }
            : null,
          status: s.event.status,
        }));
      }

      return {
        type: 'TEAM',
        id: groupId,
        parentId: teamCat.teamSeasonId,
        name: team.name,
        detail: `Categoría ${categoryName}${genderSuffix}`,
        category: categoryName,
        shift: null,
        gender: teamCat.gender,
        role: assignment.role,
        customRole: assignment.customRole,
        isPrimary: assignment.isPrimary,
        participantCount,
        administrativeCount: participantCount,
        course: null,
        team: {
          teamSeasonId: teamCat.teamSeasonId,
          teamId: team.id,
        },
        participants,
        upcomingSessions,
        recentSessions,
      };
    }
  }

  /**
   * Aserción de seguridad: Verifica que el usuario tenga asignación activa
   * en el turno de curso escolar (CourseSeasonShift).
   */
  async assertCourseSeasonShiftAccess(
    user: AuthenticatedUserContext,
    courseSeasonShiftId: string,
  ) {
    const staff = await this.resolveCurrentStaff(user);
    const now = new Date();

    const assignment = await this.prisma.courseSeasonStaff.findFirst({
      where: {
        staffId: staff.id,
        courseSeasonShiftId,
        startedAt: { lte: now },
        OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'No tiene asignación docente activa en este turno de curso.',
      );
    }

    return { staff, assignment };
  }

  /**
   * Aserción de seguridad: Verifica que el usuario tenga asignación activa
   * en la categoría de equipo (TeamSeasonCategory).
   */
  async assertTeamSeasonCategoryAccess(
    user: AuthenticatedUserContext,
    teamSeasonCategoryId: string,
  ) {
    const staff = await this.resolveCurrentStaff(user);
    const now = new Date();

    const assignment = await this.prisma.teamSeasonStaff.findFirst({
      where: {
        staffId: staff.id,
        teamSeasonCategoryId,
        startedAt: { lte: now },
        OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'No tiene asignación docente activa en esta categoría de equipo.',
      );
    }

    return { staff, assignment };
  }

  /**
   * Aserción de seguridad: Verifica que la sesión pertenezca a un curso o equipo
   * donde el usuario autenticado tiene asignación de Staff activa.
   */
  async assertSessionAccess(
    user: AuthenticatedUserContext,
    sessionId: string,
  ) {
    const staff = await this.resolveCurrentStaff(user);
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sessionCourses: true,
        sessionTeams: true,
      },
    });

    if (!session) {
      throw new NotFoundException(
        'La sesión de entrenamiento especificada no fue encontrada.',
      );
    }

    const now = new Date();
    const courseShiftIds = session.sessionCourses.map(
      (sc) => sc.courseSeasonShiftId,
    );
    const teamCategoryIds = session.sessionTeams.map(
      (st) => st.teamSeasonCategoryId,
    );

    // 1. Verificar si coincide con turno de curso asignado
    if (courseShiftIds.length > 0) {
      const activeCourseAssignment =
        await this.prisma.courseSeasonStaff.findFirst({
          where: {
            staffId: staff.id,
            courseSeasonShiftId: { in: courseShiftIds },
            startedAt: { lte: now },
            OR: [{ endedAt: null }, { endedAt: { gt: now } }],
          },
        });

      if (activeCourseAssignment) {
        return {
          staff,
          session,
          groupType: 'COURSE' as TeacherGroupType,
          groupId: activeCourseAssignment.courseSeasonShiftId,
          assignment: activeCourseAssignment,
        };
      }
    }

    // 2. Verificar si coincide con categoría de equipo asignada
    if (teamCategoryIds.length > 0) {
      const activeTeamAssignment = await this.prisma.teamSeasonStaff.findFirst({
        where: {
          staffId: staff.id,
          teamSeasonCategoryId: { in: teamCategoryIds },
          startedAt: { lte: now },
          OR: [{ endedAt: null }, { endedAt: { gt: now } }],
        },
      });

      if (activeTeamAssignment) {
        return {
          staff,
          session,
          groupType: 'TEAM' as TeacherGroupType,
          groupId: activeTeamAssignment.teamSeasonCategoryId,
          assignment: activeTeamAssignment,
        };
      }
    }

    throw new ForbiddenException(
      'No tiene asignación docente activa sobre el curso o equipo de esta sesión.',
    );
  }

  /**
   * Aserción de seguridad: Valida que un participante pertenezca activamente
   * al grupo operativo antes de registrar asistencia o evaluaciones.
   */
  async assertParticipantAccess(
    user: AuthenticatedUserContext,
    params: {
      groupId: string;
      groupType: TeacherGroupType;
      studentId?: string;
      playerId?: string;
      date?: Date;
    },
  ) {
    const { groupId, groupType, studentId, playerId, date = new Date() } = params;

    if (groupType === 'COURSE') {
      await this.assertCourseSeasonShiftAccess(user, groupId);

      if (!studentId) {
        throw new ForbiddenException(
          'Se requiere studentId para validar participante de curso.',
        );
      }

      // Validar que el estudiante pertenezca a este turno
      const validEnrollment = await this.prisma.cycleEnrollment.findFirst({
        where: {
          courseSeasonShiftId: groupId,
          studentMembership: {
            studentId,
            status: 'ACTIVE',
          },
          status: { in: ['PENDING', 'CONFIRMED'] },
          effectiveStartDate: { lte: date },
          cycleEndDate: { gt: date },
        },
      });

      if (!validEnrollment) {
        throw new ForbiddenException(
          'El estudiante no cuenta con inscripción confirmada/vigente en este turno.',
        );
      }

      return true;
    } else if (groupType === 'TEAM') {
      await this.assertTeamSeasonCategoryAccess(user, groupId);

      if (!playerId) {
        throw new ForbiddenException(
          'Se requiere playerId para validar participante de equipo.',
        );
      }

      // Validar que el jugador pertenezca a esta categoría
      const validMembership = await this.prisma.playerMembership.findFirst({
        where: {
          teamSeasonCategoryId: groupId,
          playerId,
          status: 'ACTIVE',
          startedAt: { lte: date },
          OR: [{ endedAt: null }, { endedAt: { gt: date } }],
        },
      });

      if (!validMembership) {
        throw new ForbiddenException(
          'El jugador no cuenta con membresía activa en esta categoría del equipo.',
        );
      }

      return true;
    }

    throw new ForbiddenException('Tipo de grupo no reconocido.');
  }

  /**
   * Obtiene el roster canónico de asistencia para una sesión específica de un grupo asignado.
   * Valida asignación del Staff al grupo y que la sesión pertenezca al grupo.
   * Calcula elegibilidad de participantes según la fecha exacta de la sesión y fusiona reservas existentes.
   */
  async getSessionAttendanceRoster(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
  ): Promise<SessionAttendanceRosterResponseDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    if (normalizedType === 'COURSE') {
      // 1. Autorización de recurso: Staff asignado al turno
      await this.assertCourseSeasonShiftAccess(user, groupId);

      // 2. Verificar que la sesión pertenezca exactamente a este turno
      const sessionCourse = await this.prisma.sessionCourse.findFirst({
        where: { sessionId, courseSeasonShiftId: groupId },
        include: {
          session: {
            include: {
              event: {
                include: { location: true },
              },
            },
          },
          courseSeasonShift: {
            include: {
              courseSeason: { include: { course: true } },
              shift: true,
              category: true,
            },
          },
        },
      });

      if (!sessionCourse) {
        throw new NotFoundException(
          'La sesión no está vinculada al turno de curso especificado o no existe.',
        );
      }

      const session = sessionCourse.session;
      const sessionDate = session.event.startDate;
      const shift = sessionCourse.courseSeasonShift;
      const course = shift.courseSeason.course;
      const shiftName = shift.shift?.name || 'Turno';
      const categoryName = shift.category?.name || 'General';

      // 3. Consultar reservas existentes de SessionBooking para esta sesión
      const existingBookings = await this.prisma.sessionBooking.findMany({
        where: { sessionId, isExternal: false },
        include: {
          incidents: {
            select: {
              id: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              createdById: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          student: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  imageUrl: true,
                  documentNumber: true,
                  birthDate: true,
                },
              },
            },
          },
        },
      });

      const existingBookingMap = new Map<
        string,
        { id: string; attended: boolean; student?: any; incidents?: any[] }
      >();
      for (const b of existingBookings) {
        if (b.studentId) {
          existingBookingMap.set(b.studentId, {
            id: b.id,
            attended: b.attended,
            student: b.student,
            incidents: b.incidents,
          });
        }
      }

      // 4. Consultar roster canónico para la fecha exacta de la sesión
      // Regla canónica: CycleEnrollment CONFIRMED vigente para sessionDate con StudentMembership ACTIVE
      const enrollments = await this.prisma.cycleEnrollment.findMany({
        where: {
          courseSeasonShiftId: groupId,
          status: 'CONFIRMED',
          cycleStartDate: { lte: sessionDate },
          cycleEndDate: { gt: sessionDate },
          studentMembership: {
            status: 'ACTIVE',
          },
        },
        include: {
          studentMembership: {
            include: {
              student: {
                include: {
                  person: {
                    select: {
                      id: true,
                      name: true,
                      lastName: true,
                      secondLastName: true,
                      imageUrl: true,
                      documentNumber: true,
                      birthDate: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { studentMembership: { student: { person: { lastName: 'asc' } } } },
          { studentMembership: { student: { person: { name: 'asc' } } } },
        ],
      });

      const seenParticipantIds = new Set<string>();
      const participants: AttendanceParticipantDto[] = [];

      for (const e of enrollments) {
        const student = e.studentMembership?.student;
        if (!student) continue;
        const person = student.person;
        seenParticipantIds.add(student.id);

        const booking = existingBookingMap.get(student.id);

        participants.push({
          participantType: 'STUDENT',
          participantId: student.id,
          membershipId: e.studentMembershipId,
          firstName: person.name,
          lastName: person.lastName,
          secondLastName: person.secondLastName,
          imageUrl: person.imageUrl,
          documentNumber: person.documentNumber,
          birthDate: person.birthDate,
          attendance: {
            bookingId: booking?.id || null,
            attended: booking !== undefined ? booking.attended : null,
            incidents: booking?.incidents || [],
          },
        });
      }

      // 5. Preservar reservas históricas existentes de alumnos que pudieron cambiar de ciclo
      for (const [studentId, bookingData] of existingBookingMap.entries()) {
        if (!seenParticipantIds.has(studentId) && bookingData.student?.person) {
          const person = bookingData.student.person;
          participants.push({
            participantType: 'STUDENT',
            participantId: studentId,
            membershipId: '',
            firstName: person.name,
            lastName: person.lastName,
            secondLastName: person.secondLastName,
            imageUrl: person.imageUrl,
            documentNumber: person.documentNumber,
            birthDate: person.birthDate,
            attendance: {
              bookingId: bookingData.id,
              attended: bookingData.attended,
              incidents: bookingData.incidents || [],
            },
          });
        }
      }

      // Ordenar determinísticamente por apellido y nombre
      participants.sort((a, b) => {
        const comp = a.lastName.localeCompare(b.lastName);
        return comp !== 0 ? comp : a.firstName.localeCompare(b.firstName);
      });

      const durationMin = session.durationMin || 90;
      const startDate = session.event.startDate;
      const endDate =
        session.event.endDate ||
        new Date(startDate.getTime() + durationMin * 60000);

      const present = participants.filter(
        (p) => p.attendance.attended === true,
      ).length;
      const absent = participants.filter(
        (p) => p.attendance.attended === false,
      ).length;
      const unregistered = participants.filter(
        (p) => p.attendance.attended === null,
      ).length;

      return {
        session: {
          id: session.id,
          title: session.event.title || course.name,
          startDate,
          endDate,
          durationMin,
          status: session.event.status,
          location: session.event.location
            ? {
                id: session.event.location.id,
                name: session.event.location.name,
                address: session.event.location.address,
              }
            : null,
        },
        group: {
          type: 'COURSE',
          id: groupId,
          name: course.name,
          detail: `${shiftName} (${categoryName})`,
          category: categoryName,
          shift: shiftName,
        },
        participants,
        summary: {
          total: participants.length,
          present,
          absent,
          unregistered,
        },
      };
    } else {
      // TEAM:
      // 1. Autorización de recurso: Staff asignado a la categoría del equipo
      await this.assertTeamSeasonCategoryAccess(user, groupId);

      // 2. Verificar que la sesión pertenezca exactamente a esta categoría
      const sessionTeam = await this.prisma.sessionTeam.findFirst({
        where: { sessionId, teamSeasonCategoryId: groupId },
        include: {
          session: {
            include: {
              event: {
                include: { location: true },
              },
            },
          },
          teamSeasonCategory: {
            include: {
              teamSeason: { include: { team: true } },
              category: true,
            },
          },
        },
      });

      if (!sessionTeam) {
        throw new NotFoundException(
          'La sesión no está vinculada a la categoría de equipo especificada o no existe.',
        );
      }

      const session = sessionTeam.session;
      const sessionDate = session.event.startDate;
      const teamCat = sessionTeam.teamSeasonCategory;
      const team = teamCat.teamSeason.team;
      const categoryName = teamCat.category?.name || 'General';
      const genderSuffix = teamCat.gender ? ` (${teamCat.gender})` : '';

      // 3. Consultar reservas existentes de SessionBooking para esta sesión
      const existingBookings = await this.prisma.sessionBooking.findMany({
        where: { sessionId, isExternal: false },
        include: {
          incidents: {
            select: {
              id: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              createdById: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          player: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  imageUrl: true,
                  documentNumber: true,
                  birthDate: true,
                },
              },
            },
          },
        },
      });

      const existingBookingMap = new Map<
        string,
        { id: string; attended: boolean; player?: any; incidents?: any[] }
      >();
      for (const b of existingBookings) {
        if (b.playerId) {
          existingBookingMap.set(b.playerId, {
            id: b.id,
            attended: b.attended,
            player: b.player,
            incidents: b.incidents,
          });
        }
      }

      // 4. Consultar roster canónico para la fecha exacta de la sesión
      // Regla canónica: PlayerMembership ACTIVE, startedAt <= sessionDate, (endedAt == null || endedAt > sessionDate)
      const memberships = await this.prisma.playerMembership.findMany({
        where: {
          teamSeasonCategoryId: groupId,
          status: 'ACTIVE',
          startedAt: { lte: sessionDate },
          OR: [{ endedAt: null }, { endedAt: { gt: sessionDate } }],
        },
        include: {
          player: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                  imageUrl: true,
                  documentNumber: true,
                  birthDate: true,
                },
              },
            },
          },
        },
        orderBy: [
          { player: { person: { lastName: 'asc' } } },
          { player: { person: { name: 'asc' } } },
        ],
      });

      const seenParticipantIds = new Set<string>();
      const participants: AttendanceParticipantDto[] = [];

      for (const m of memberships) {
        const player = m.player;
        if (!player) continue;
        const person = player.person;
        seenParticipantIds.add(player.id);

        const booking = existingBookingMap.get(player.id);

        participants.push({
          participantType: 'PLAYER',
          participantId: player.id,
          membershipId: m.id,
          firstName: person.name,
          lastName: person.lastName,
          secondLastName: person.secondLastName,
          imageUrl: person.imageUrl,
          documentNumber: person.documentNumber,
          birthDate: person.birthDate,
          attendance: {
            bookingId: booking?.id || null,
            attended: booking !== undefined ? booking.attended : null,
            incidents: booking?.incidents || [],
          },
        });
      }

      // 5. Preservar reservas históricas existentes de jugadores que ya no estén activos hoy
      for (const [playerId, bookingData] of existingBookingMap.entries()) {
        if (!seenParticipantIds.has(playerId) && bookingData.player?.person) {
          const person = bookingData.player.person;
          participants.push({
            participantType: 'PLAYER',
            participantId: playerId,
            membershipId: '',
            firstName: person.name,
            lastName: person.lastName,
            secondLastName: person.secondLastName,
            imageUrl: person.imageUrl,
            documentNumber: person.documentNumber,
            birthDate: person.birthDate,
            attendance: {
              bookingId: bookingData.id,
              attended: bookingData.attended,
              incidents: bookingData.incidents || [],
            },
          });
        }
      }

      participants.sort((a, b) => {
        const comp = a.lastName.localeCompare(b.lastName);
        return comp !== 0 ? comp : a.firstName.localeCompare(b.firstName);
      });

      const durationMin = session.durationMin || 90;
      const startDate = session.event.startDate;
      const endDate =
        session.event.endDate ||
        new Date(startDate.getTime() + durationMin * 60000);

      const present = participants.filter(
        (p) => p.attendance.attended === true,
      ).length;
      const absent = participants.filter(
        (p) => p.attendance.attended === false,
      ).length;
      const unregistered = participants.filter(
        (p) => p.attendance.attended === null,
      ).length;

      return {
        session: {
          id: session.id,
          title: session.event.title || team.name,
          startDate,
          endDate,
          durationMin,
          status: session.event.status,
          location: session.event.location
            ? {
                id: session.event.location.id,
                name: session.event.location.name,
                address: session.event.location.address,
              }
            : null,
        },
        group: {
          type: 'TEAM',
          id: groupId,
          name: team.name,
          detail: `Categoría ${categoryName}${genderSuffix}`,
          category: categoryName,
          shift: null,
        },
        participants,
        summary: {
          total: participants.length,
          present,
          absent,
          unregistered,
        },
      };
    }
  }

  /**
   * Guarda de forma transaccional, atómica e idempotente la asistencia masiva
   * de una sesión para el grupo asignado.
   * Valida estrictamente que cada participante pertenezca al roster canónico de la sesión.
   * Aplica semántica de todo-o-nada (rollback completo si una entrada es inválida).
   * No elimina reservas omitidas ni toca reservas externas (isExternal = true).
   */
  async saveSessionAttendanceBulk(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
    dto: BulkAttendanceDto,
  ): Promise<BulkAttendanceResponseDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    if (!dto || !Array.isArray(dto.entries)) {
      throw new BadRequestException('El cuerpo debe incluir un arreglo entries.');
    }

    // 1. Autorización de recurso y vinculación de sesión
    let sessionDate: Date;

    if (normalizedType === 'COURSE') {
      await this.assertCourseSeasonShiftAccess(user, groupId);

      const sessionCourse = await this.prisma.sessionCourse.findFirst({
        where: { sessionId, courseSeasonShiftId: groupId },
        include: { session: { include: { event: true } } },
      });

      if (!sessionCourse) {
        throw new NotFoundException(
          'La sesión no está vinculada al turno de curso especificado o no existe.',
        );
      }

      sessionDate = sessionCourse.session.event.startDate;
    } else {
      await this.assertTeamSeasonCategoryAccess(user, groupId);

      const sessionTeam = await this.prisma.sessionTeam.findFirst({
        where: { sessionId, teamSeasonCategoryId: groupId },
        include: { session: { include: { event: true } } },
      });

      if (!sessionTeam) {
        throw new NotFoundException(
          'La sesión no está vinculada a la categoría de equipo especificada o no existe.',
        );
      }

      sessionDate = sessionTeam.session.event.startDate;
    }

    // 2. Re-calcular roster permitido para la fecha de la sesión (No confiar en el cliente)
    const allowedParticipantIds = new Set<string>();

    if (normalizedType === 'COURSE') {
      const validEnrollments = await this.prisma.cycleEnrollment.findMany({
        where: {
          courseSeasonShiftId: groupId,
          status: 'CONFIRMED',
          cycleStartDate: { lte: sessionDate },
          cycleEndDate: { gt: sessionDate },
          studentMembership: {
            status: 'ACTIVE',
          },
        },
        select: {
          studentMembership: {
            select: { studentId: true },
          },
        },
      });

      for (const e of validEnrollments) {
        if (e.studentMembership?.studentId) {
          allowedParticipantIds.add(e.studentMembership.studentId);
        }
      }

      // Incluir también participantes que ya poseían un SessionBooking válido en esta sesión
      const existingBookings = await this.prisma.sessionBooking.findMany({
        where: { sessionId, isExternal: false, studentId: { not: null } },
        select: { studentId: true },
      });
      for (const b of existingBookings) {
        if (b.studentId) allowedParticipantIds.add(b.studentId);
      }
    } else {
      const validMemberships = await this.prisma.playerMembership.findMany({
        where: {
          teamSeasonCategoryId: groupId,
          status: 'ACTIVE',
          startedAt: { lte: sessionDate },
          OR: [{ endedAt: null }, { endedAt: { gt: sessionDate } }],
        },
        select: { playerId: true },
      });

      for (const m of validMemberships) {
        if (m.playerId) {
          allowedParticipantIds.add(m.playerId);
        }
      }

      const existingBookings = await this.prisma.sessionBooking.findMany({
        where: { sessionId, isExternal: false, playerId: { not: null } },
        select: { playerId: true },
      });
      for (const b of existingBookings) {
        if (b.playerId) allowedParticipantIds.add(b.playerId);
      }
    }

    // 3. Validar todas las entradas del payload ANTES de abrir la transacción (All-or-nothing)
    for (const entry of dto.entries) {
      if (!allowedParticipantIds.has(entry.participantId)) {
        throw new BadRequestException(
          `El participante con ID ${entry.participantId} no pertenece al roster válido de esta sesión. Operación cancelada.`,
        );
      }
    }

    // 4. Verificación de permisos de mutación (CREATE / UPDATE)
    const userPermissions = user.permissions || [];
    const hasCreate = userPermissions.includes('CREATE_SESSION_BOOKINGS');
    const hasUpdate = userPermissions.includes('UPDATE_SESSION_BOOKINGS');

    if (!hasCreate && !hasUpdate) {
      throw new ForbiddenException(
        'No posees permisos de creación ni actualización de asistencias.',
      );
    }

    // 5. Transacción atómica e idempotente (Upsert batch)
    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        if (normalizedType === 'COURSE') {
          await tx.sessionBooking.upsert({
            where: {
              sessionId_studentId: {
                sessionId,
                studentId: entry.participantId,
              },
            },
            create: {
              sessionId,
              studentId: entry.participantId,
              attended: entry.attended,
              isExternal: false,
              createdById: user.id,
              updatedById: user.id,
            },
            update: {
              attended: entry.attended,
              updatedById: user.id,
            },
          });
        } else {
          await tx.sessionBooking.upsert({
            where: {
              sessionId_playerId: {
                sessionId,
                playerId: entry.participantId,
              },
            },
            create: {
              sessionId,
              playerId: entry.participantId,
              attended: entry.attended,
              isExternal: false,
              createdById: user.id,
              updatedById: user.id,
            },
            update: {
              attended: entry.attended,
              updatedById: user.id,
            },
          });
        }
      }
    });

    const presentCount = dto.entries.filter((e) => e.attended === true).length;
    const absentCount = dto.entries.filter((e) => e.attended === false).length;

    return {
      sessionId,
      groupId,
      savedCount: dto.entries.length,
      presentCount,
      absentCount,
    };
  }

  /**
   * Obtiene el historial de evaluaciones de un grupo operativo específico asignado al docente.
   * Filtra estrictamente por courseSeasonShiftId o teamSeasonCategoryId para garantizar cero contaminación cruzada.
   */
  async getGroupEvaluations(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    participantId?: string,
  ): Promise<TeacherGroupEvaluationsResponseDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    // 1. Permiso
    const userPermissions: string[] = user.permissions || [];
    if (!userPermissions.includes('READ_PROGRESS_EVALUATIONS')) {
      throw new ForbiddenException(
        'No posees permisos para consultar las evaluaciones del grupo.',
      );
    }

    // 2. Aserción de asignación de Staff activa al grupo
    let currentStaff;
    if (normalizedType === 'COURSE') {
      const access = await this.assertCourseSeasonShiftAccess(user, groupId);
      currentStaff = access.staff;
    } else {
      const access = await this.assertTeamSeasonCategoryAccess(user, groupId);
      currentStaff = access.staff;
    }

    // 3. Consulta canónica por clave foránea explícita de grupo
    const canUpdateEvaluations = userPermissions.includes(
      'UPDATE_PROGRESS_EVALUATIONS',
    );

    const whereClause: any =
      normalizedType === 'COURSE'
        ? {
            courseSeasonShiftId: groupId,
            ...(participantId ? { studentId: participantId } : {}),
          }
        : {
            teamSeasonCategoryId: groupId,
            ...(participantId ? { playerId: participantId } : {}),
          };

    const evaluations = await this.prisma.progressEvaluation.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
        player: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
        evaluatorStaff: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        evaluationDate: 'desc',
      },
    });

    const items: TeacherEvaluationItemDto[] = evaluations.map((item) => {
      const person =
        normalizedType === 'COURSE'
          ? item.student?.person
          : item.player?.person;

      const participantName = person
        ? [person.lastName, person.secondLastName, person.name]
            .filter(Boolean)
            .join(' ')
        : 'Participante';

      const evalPerson = item.evaluatorStaff?.person;
      const evaluatorDisplayName = evalPerson
        ? [evalPerson.name, evalPerson.lastName, evalPerson.secondLastName]
            .filter(Boolean)
            .join(' ')
        : 'Docente';

      const canEdit =
        item.evaluatorStaffId === currentStaff.id && canUpdateEvaluations;

      return {
        id: item.id,
        evaluationDate: item.evaluationDate,
        technicalScore: item.technicalScore,
        tacticalScore: item.tacticalScore,
        physicalScore: item.physicalScore,
        behaviorScore: item.behaviorScore,
        notes: item.notes,
        participantId:
          (normalizedType === 'COURSE' ? item.studentId : item.playerId) || '',
        participantName,
        evaluator: {
          id: item.evaluatorStaffId,
          displayName: evaluatorDisplayName,
        },
        canEdit,
      };
    });

    return {
      evaluations: items,
      total: items.length,
    };
  }

  /**
   * Crea una evaluación trazada de manera canónica e inequívoca al grupo operativo.
   * Deriva seasonId y evaluatorStaffId en el backend para evitar desincronización o fraude.
   */
  async createGroupEvaluation(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    dto: TeacherCreateEvaluationDto,
  ): Promise<TeacherEvaluationItemDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    // 1. Permiso
    const userPermissions: string[] = user.permissions || [];
    if (!userPermissions.includes('CREATE_PROGRESS_EVALUATIONS')) {
      throw new ForbiddenException(
        'No posees permisos para registrar evaluaciones en este grupo.',
      );
    }

    // 2. Aserción de asignación y derivación canónica
    let seasonId: string;
    let currentStaff;

    if (normalizedType === 'COURSE') {
      const access = await this.assertCourseSeasonShiftAccess(user, groupId);
      currentStaff = access.staff;

      const shift = await this.prisma.courseSeasonShift.findUnique({
        where: { id: groupId },
        include: {
          courseSeason: {
            select: { seasonId: true },
          },
        },
      });

      if (!shift) {
        throw new NotFoundException('Turno de curso no encontrado.');
      }
      seasonId = shift.courseSeason.seasonId;

      // Validar que el estudiante pertenezca al turno (cycleEnrollment o studentMembership)
      const hasEnrollment = await this.prisma.cycleEnrollment.findFirst({
        where: {
          courseSeasonShiftId: groupId,
          studentMembership: {
            studentId: dto.participantId,
          },
        },
      });
      const hasMembership = await this.prisma.studentMembership.findFirst({
        where: {
          courseSeasonShiftId: groupId,
          studentId: dto.participantId,
        },
      });

      if (!hasEnrollment && !hasMembership) {
        throw new BadRequestException(
          'El estudiante especificado no pertenece a este turno de curso.',
        );
      }

      const evaluation = await this.prisma.progressEvaluation.create({
        data: {
          studentId: dto.participantId,
          courseSeasonShiftId: groupId,
          seasonId,
          evaluatorStaffId: currentStaff.id,
          evaluationDate: dto.evaluationDate,
          technicalScore: dto.technicalScore,
          tacticalScore: dto.tacticalScore,
          physicalScore: dto.physicalScore,
          behaviorScore: dto.behaviorScore,
          notes: dto.notes,
          createdById: user.id,
          updatedById: user.id,
        },
        include: {
          student: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                },
              },
            },
          },
          evaluatorStaff: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                },
              },
            },
          },
        },
      });

      const person = evaluation.student?.person;
      const participantName = person
        ? [person.lastName, person.secondLastName, person.name]
            .filter(Boolean)
            .join(' ')
        : 'Estudiante';

      const evalPerson = evaluation.evaluatorStaff?.person;
      const evaluatorDisplayName = evalPerson
        ? [evalPerson.name, evalPerson.lastName, evalPerson.secondLastName]
            .filter(Boolean)
            .join(' ')
        : 'Docente';

      const canUpdate = userPermissions.includes('UPDATE_PROGRESS_EVALUATIONS');

      return {
        id: evaluation.id,
        evaluationDate: evaluation.evaluationDate,
        technicalScore: evaluation.technicalScore,
        tacticalScore: evaluation.tacticalScore,
        physicalScore: evaluation.physicalScore,
        behaviorScore: evaluation.behaviorScore,
        notes: evaluation.notes,
        participantId: evaluation.studentId!,
        participantName,
        evaluator: {
          id: evaluation.evaluatorStaffId,
          displayName: evaluatorDisplayName,
        },
        canEdit: canUpdate,
      };
    } else {
      const access = await this.assertTeamSeasonCategoryAccess(user, groupId);
      currentStaff = access.staff;

      const teamCat = await this.prisma.teamSeasonCategory.findUnique({
        where: { id: groupId },
        include: {
          teamSeason: {
            select: { seasonId: true },
          },
        },
      });

      if (!teamCat) {
        throw new NotFoundException('Categoría de equipo no encontrada.');
      }
      seasonId = teamCat.teamSeason.seasonId;

      // Validar que el jugador pertenezca a la categoría (playerMembership)
      const hasMembership = await this.prisma.playerMembership.findFirst({
        where: {
          teamSeasonCategoryId: groupId,
          playerId: dto.participantId,
        },
      });

      if (!hasMembership) {
        throw new BadRequestException(
          'El jugador especificado no pertenece a esta categoría de equipo.',
        );
      }

      const evaluation = await this.prisma.progressEvaluation.create({
        data: {
          playerId: dto.participantId,
          teamSeasonCategoryId: groupId,
          seasonId,
          evaluatorStaffId: currentStaff.id,
          evaluationDate: dto.evaluationDate,
          technicalScore: dto.technicalScore,
          tacticalScore: dto.tacticalScore,
          physicalScore: dto.physicalScore,
          behaviorScore: dto.behaviorScore,
          notes: dto.notes,
          createdById: user.id,
          updatedById: user.id,
        },
        include: {
          player: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                },
              },
            },
          },
          evaluatorStaff: {
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  lastName: true,
                  secondLastName: true,
                },
              },
            },
          },
        },
      });

      const person = evaluation.player?.person;
      const participantName = person
        ? [person.lastName, person.secondLastName, person.name]
            .filter(Boolean)
            .join(' ')
        : 'Jugador';

      const evalPerson = evaluation.evaluatorStaff?.person;
      const evaluatorDisplayName = evalPerson
        ? [evalPerson.name, evalPerson.lastName, evalPerson.secondLastName]
            .filter(Boolean)
            .join(' ')
        : 'Entrenador';

      const canUpdate = userPermissions.includes('UPDATE_PROGRESS_EVALUATIONS');

      return {
        id: evaluation.id,
        evaluationDate: evaluation.evaluationDate,
        technicalScore: evaluation.technicalScore,
        tacticalScore: evaluation.tacticalScore,
        physicalScore: evaluation.physicalScore,
        behaviorScore: evaluation.behaviorScore,
        notes: evaluation.notes,
        participantId: evaluation.playerId!,
        participantName,
        evaluator: {
          id: evaluation.evaluatorStaffId,
          displayName: evaluatorDisplayName,
        },
        canEdit: canUpdate,
      };
    }
  }

  /**
   * Actualiza los scores o notas de una evaluación.
   * Aplica validación estricta de Ownership: solo el autor original (evaluatorStaffId === currentStaff.id)
   * puede mutar la evaluación.
   */
  async updateGroupEvaluation(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    evaluationId: string,
    dto: TeacherUpdateEvaluationDto,
  ): Promise<TeacherEvaluationItemDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException(
        'Tipo de grupo inválido. Debe ser COURSE o TEAM.',
      );
    }

    // 1. Permiso
    const userPermissions: string[] = user.permissions || [];
    if (!userPermissions.includes('UPDATE_PROGRESS_EVALUATIONS')) {
      throw new ForbiddenException(
        'No posees permisos para actualizar evaluaciones en este grupo.',
      );
    }

    // 2. Aserción de asignación del Staff al grupo
    let currentStaff;
    if (normalizedType === 'COURSE') {
      const access = await this.assertCourseSeasonShiftAccess(user, groupId);
      currentStaff = access.staff;
    } else {
      const access = await this.assertTeamSeasonCategoryAccess(user, groupId);
      currentStaff = access.staff;
    }

    // 3. Buscar la evaluación existente
    const existing = await this.prisma.progressEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!existing) {
      throw new NotFoundException('Evaluación no encontrada.');
    }

    // 4. Validar pertenencia de la evaluación al grupo
    if (
      normalizedType === 'COURSE' &&
      existing.courseSeasonShiftId !== groupId
    ) {
      throw new BadRequestException(
        'La evaluación no pertenece a este turno de curso.',
      );
    }

    if (
      normalizedType === 'TEAM' &&
      existing.teamSeasonCategoryId !== groupId
    ) {
      throw new BadRequestException(
        'La evaluación no pertenece a esta categoría de equipo.',
      );
    }

    // 5. Verificación estricta de Ownership: solo el evaluador original puede editar
    if (existing.evaluatorStaffId !== currentStaff.id) {
      throw new ForbiddenException(
        'No tienes autorización para modificar una evaluación creada por otro docente o entrenador.',
      );
    }

    // 6. Mutar exclusivamente campos permitidos (cero alteración de identidades, grupos, seasonId o evaluador)
    const updated = await this.prisma.progressEvaluation.update({
      where: { id: evaluationId },
      data: {
        ...(dto.evaluationDate !== undefined && {
          evaluationDate: dto.evaluationDate,
        }),
        ...(dto.technicalScore !== undefined && {
          technicalScore: dto.technicalScore,
        }),
        ...(dto.tacticalScore !== undefined && {
          tacticalScore: dto.tacticalScore,
        }),
        ...(dto.physicalScore !== undefined && {
          physicalScore: dto.physicalScore,
        }),
        ...(dto.behaviorScore !== undefined && {
          behaviorScore: dto.behaviorScore,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        updatedById: user.id,
      },
      include: {
        student: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
        player: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
        evaluatorStaff: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                lastName: true,
                secondLastName: true,
              },
            },
          },
        },
      },
    });

    const person =
      normalizedType === 'COURSE'
        ? updated.student?.person
        : updated.player?.person;

    const participantName = person
      ? [person.lastName, person.secondLastName, person.name]
          .filter(Boolean)
          .join(' ')
      : 'Participante';

    const evalPerson = updated.evaluatorStaff?.person;
    const evaluatorDisplayName = evalPerson
      ? [evalPerson.name, evalPerson.lastName, evalPerson.secondLastName]
          .filter(Boolean)
          .join(' ')
      : 'Docente';

    return {
      id: updated.id,
      evaluationDate: updated.evaluationDate,
      technicalScore: updated.technicalScore,
      tacticalScore: updated.tacticalScore,
      physicalScore: updated.physicalScore,
      behaviorScore: updated.behaviorScore,
      notes: updated.notes,
      participantId:
        (normalizedType === 'COURSE' ? updated.studentId : updated.playerId) ||
        '',
      participantName,
      evaluator: {
        id: updated.evaluatorStaffId,
        displayName: evaluatorDisplayName,
      },
      canEdit: true,
    };
  }

  // ==========================================
  // PHASE F: TEACHER-SCOPED SESSIONS & INCIDENTS
  // ==========================================

  /**
   * Crea una nueva sesión de entrenamiento vinculada exclusivamente al grupo asignado.
   * La relación CourseSeasonShift o TeamSeasonCategory se deriva estrictamente del path.
   */
  async createGroupSession(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    dto: TeacherCreateSessionDto,
  ): Promise<TeacherGroupSessionDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException('Tipo de grupo inválido. Debe ser COURSE o TEAM.');
    }

    if (normalizedType === 'COURSE') {
      await this.assertCourseSeasonShiftAccess(user, groupId);
    } else {
      await this.assertTeamSeasonCategoryAccess(user, groupId);
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Las fechas deben ser válidas en formato ISO 8601.');
    }
    if (end <= start) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
    }

    const durationMin =
      dto.durationMin ??
      (Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)) || 90);

    const createDto: CreateSessionDto = {
      title:
        dto.title?.trim() ||
        (normalizedType === 'COURSE' ? 'Clase' : 'Entrenamiento'),
      startDate: dto.startDate,
      endDate: dto.endDate,
      durationMin,
      locationId: dto.locationId ?? undefined,
      courseSeasonShiftIds:
        normalizedType === 'COURSE' ? [groupId] : undefined,
      teamSeasonCategoryIds:
        normalizedType === 'TEAM' ? [groupId] : undefined,
    };

    const result = await this.sessionsService.create(createDto, user.id);

    const session = await this.prisma.session.findUnique({
      where: { id: result.data.id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            status: true,
            location: {
              select: { id: true, name: true, address: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Error al recuperar la sesión recién creada.');
    }

    return {
      id: session.id,
      eventId: session.event.id,
      title: session.event.title || 'Sesión',
      startDate: session.event.startDate,
      endDate: session.event.endDate || session.event.startDate,
      durationMin: session.durationMin,
      status: session.event.status,
      location: session.event.location,
    };
  }

  /**
   * Obtiene los detalles de una sesión asegurando pertenencia estricta al grupo asignado.
   */
  async getGroupSession(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
  ): Promise<TeacherSessionDetailDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException('Tipo de grupo inválido. Debe ser COURSE o TEAM.');
    }

    if (normalizedType === 'COURSE') {
      await this.assertCourseSeasonShiftAccess(user, groupId);
      const sessionCourse = await this.prisma.sessionCourse.findUnique({
        where: {
          sessionId_courseSeasonShiftId: {
            sessionId,
            courseSeasonShiftId: groupId,
          },
        },
        include: {
          session: {
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  endDate: true,
                  status: true,
                  location: { select: { id: true, name: true, address: true } },
                },
              },
              _count: { select: { bookings: true } },
            },
          },
        },
      });

      if (!sessionCourse) {
        throw new NotFoundException('La sesión no pertenece al turno asignado o no existe.');
      }

      const s = sessionCourse.session;
      return {
        id: s.id,
        eventId: s.event.id,
        title: s.event.title || 'Sesión',
        startDate: s.event.startDate,
        endDate: s.event.endDate || s.event.startDate,
        durationMin: s.durationMin,
        status: s.event.status,
        location: s.event.location,
        hasBookings: s._count.bookings > 0,
        bookingsCount: s._count.bookings,
      };
    } else {
      await this.assertTeamSeasonCategoryAccess(user, groupId);
      const sessionTeam = await this.prisma.sessionTeam.findUnique({
        where: {
          sessionId_teamSeasonCategoryId: {
            sessionId,
            teamSeasonCategoryId: groupId,
          },
        },
        include: {
          session: {
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  endDate: true,
                  status: true,
                  location: { select: { id: true, name: true, address: true } },
                },
              },
              _count: { select: { bookings: true } },
            },
          },
        },
      });

      if (!sessionTeam) {
        throw new NotFoundException('La sesión no pertenece a la categoría asignada o no existe.');
      }

      const s = sessionTeam.session;
      return {
        id: s.id,
        eventId: s.event.id,
        title: s.event.title || 'Sesión',
        startDate: s.event.startDate,
        endDate: s.event.endDate || s.event.startDate,
        durationMin: s.durationMin,
        status: s.event.status,
        location: s.event.location,
        hasBookings: s._count.bookings > 0,
        bookingsCount: s._count.bookings,
      };
    }
  }

  /**
   * Actualiza una sesión autorizada, validando inmutabilidad del grupo y protegiendo
   * la fecha si ya existen asistencias históricas registradas.
   */
  async updateGroupSession(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
    dto: TeacherUpdateSessionDto,
  ): Promise<TeacherGroupSessionDto> {
    const sessionDetail = await this.getGroupSession(user, type, groupId, sessionId);

    // Protección de integridad histórica (Requirement 17)
    if (sessionDetail.hasBookings && dto.startDate) {
      const currentStart = new Date(sessionDetail.startDate).toISOString();
      const newStart = new Date(dto.startDate).toISOString();
      if (currentStart !== newStart) {
        throw new BadRequestException(
          'No se puede modificar la fecha de inicio de una sesión que ya cuenta con asistencias registradas.',
        );
      }
    }

    const start = dto.startDate ? new Date(dto.startDate) : new Date(sessionDetail.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : new Date(sessionDetail.endDate);
    if (dto.startDate || dto.endDate) {
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Las fechas deben ser válidas en formato ISO 8601.');
      }
      if (end <= start) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
      }
    }

    const durationMin =
      dto.durationMin ??
      (dto.startDate && dto.endDate
        ? Math.round((end.getTime() - start.getTime()) / 60000)
        : undefined);

    if (
      dto.status &&
      !['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(dto.status)
    ) {
      throw new BadRequestException('Estado de sesión inválido.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: sessionDetail.eventId },
        data: {
          ...(dto.title !== undefined && { title: dto.title?.trim() }),
          ...(dto.startDate && { startDate: start }),
          ...(dto.endDate && { endDate: end }),
          ...(dto.locationId !== undefined && { locationId: dto.locationId }),
          ...(dto.status && { status: dto.status as any }),
          updatedById: user.id,
        },
      });

      if (durationMin !== undefined) {
        await tx.session.update({
          where: { id: sessionId },
          data: { durationMin },
        });
      }
    });

    const updated = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            status: true,
            location: { select: { id: true, name: true, address: true } },
          },
        },
      },
    });

    if (!updated) {
      throw new NotFoundException('Error al recuperar la sesión actualizada.');
    }

    return {
      id: updated.id,
      eventId: updated.event.id,
      title: updated.event.title || 'Sesión',
      startDate: updated.event.startDate,
      endDate: updated.event.endDate || updated.event.startDate,
      durationMin: updated.durationMin,
      status: updated.event.status,
      location: updated.event.location,
    };
  }

  /**
   * Cancela una sesión operativa en vez de eliminarla físicamente (preserva auditoría y bookings).
   */
  async cancelGroupSession(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
  ): Promise<TeacherGroupSessionDto> {
    return this.updateGroupSession(user, type, groupId, sessionId, {
      status: 'CANCELLED',
    });
  }

  /**
   * Obtiene todos los incidentes u observaciones disciplinarias de la sesión en batch (0 N+1).
   */
  async getGroupSessionIncidents(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
  ): Promise<TeacherSessionIncidentsResponseDto> {
    await this.getGroupSession(user, type, groupId, sessionId);

    const incidents = await this.prisma.sessionIncident.findMany({
      where: {
        sessionBooking: {
          sessionId,
        },
      },
      include: {
        sessionBooking: {
          include: {
            student: {
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
            },
            player: {
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
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            person: { select: { name: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: TeacherIncidentItemDto[] = incidents.map((inc) => {
      const booking = inc.sessionBooking;
      const isStudent = !!booking.student;
      const person = isStudent ? booking.student?.person : booking.player?.person;
      const participantId = isStudent ? booking.studentId! : booking.playerId!;

      const canEdit =
        inc.createdById === user.id ||
        user.role?.name === 'SUPER_ADMIN' ||
        user.permissions?.includes('ADMIN') ||
        false;

      return {
        id: inc.id,
        sessionBookingId: inc.sessionBookingId,
        description: inc.description,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        createdById: inc.createdById,
        canEdit,
        participant: {
          id: participantId,
          name: person?.name || '',
          lastName: person?.lastName || '',
          secondLastName: person?.secondLastName || null,
          imageUrl: person?.imageUrl || null,
          type: isStudent ? 'STUDENT' : 'PLAYER',
        },
        author: inc.createdBy
          ? {
              id: inc.createdBy.id,
              email: inc.createdBy.email,
              name: inc.createdBy.person
                ? `${inc.createdBy.person.name} ${inc.createdBy.person.lastName}`
                : null,
            }
          : null,
      };
    });

    return {
      incidents: items,
      total: items.length,
    };
  }

  /**
   * Registra un nuevo incidente de conducta asociado a un participante en la sesión.
   * Resuelve o crea de forma segura el SessionBooking necesario.
   */
  async createGroupSessionIncident(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
    dto: TeacherCreateIncidentDto,
  ): Promise<TeacherIncidentItemDto> {
    const normalizedType = type?.toUpperCase() as TeacherGroupType;
    if (normalizedType !== 'COURSE' && normalizedType !== 'TEAM') {
      throw new BadRequestException('Tipo de grupo inválido. Debe ser COURSE o TEAM.');
    }

    // 1. Verificar sesión vinculada al grupo
    await this.getGroupSession(user, type, groupId, sessionId);

    // 2. Verificar pertenencia del participante al grupo
    if (normalizedType === 'COURSE') {
      const enrollment = await this.prisma.cycleEnrollment.findFirst({
        where: {
          courseSeasonShiftId: groupId,
          studentMembership: { studentId: dto.participantId },
        },
      });
      const membership = await this.prisma.studentMembership.findFirst({
        where: { courseSeasonShiftId: groupId, studentId: dto.participantId },
      });
      const existingBooking = await this.prisma.sessionBooking.findFirst({
        where: { sessionId, studentId: dto.participantId },
      });

      if (!enrollment && !membership && !existingBooking) {
        throw new ForbiddenException('El estudiante no pertenece a este turno de curso.');
      }
    } else {
      const membership = await this.prisma.playerMembership.findFirst({
        where: { teamSeasonCategoryId: groupId, playerId: dto.participantId },
      });
      const existingBooking = await this.prisma.sessionBooking.findFirst({
        where: { sessionId, playerId: dto.participantId },
      });

      if (!membership && !existingBooking) {
        throw new ForbiddenException('El jugador no pertenece a esta categoría de equipo.');
      }
    }

    // 3. Localizar o instanciar la reserva del participante para esta sesión
    let booking = await this.prisma.sessionBooking.findFirst({
      where: {
        sessionId,
        ...(normalizedType === 'COURSE'
          ? { studentId: dto.participantId }
          : { playerId: dto.participantId }),
      },
    });

    if (!booking) {
      booking = await this.prisma.sessionBooking.create({
        data: {
          sessionId,
          ...(normalizedType === 'COURSE'
            ? { studentId: dto.participantId }
            : { playerId: dto.participantId }),
          attended: false,
          isExternal: false,
          createdById: user.id,
        },
      });
    }

    // 4. Crear el reporte de incidente vinculado a la reserva
    const incident = await this.prisma.sessionIncident.create({
      data: {
        sessionBookingId: booking.id,
        description: dto.description.trim(),
        createdById: user.id,
      },
      include: {
        sessionBooking: {
          include: {
            student: {
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
            },
            player: {
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
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            person: { select: { name: true, lastName: true } },
          },
        },
      },
    });

    const b = incident.sessionBooking;
    const isStudent = !!b.student;
    const person = isStudent ? b.student?.person : b.player?.person;
    const participantId = isStudent ? b.studentId! : b.playerId!;

    return {
      id: incident.id,
      sessionBookingId: incident.sessionBookingId,
      description: incident.description,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      createdById: incident.createdById,
      canEdit: true,
      participant: {
        id: participantId,
        name: person?.name || '',
        lastName: person?.lastName || '',
        secondLastName: person?.secondLastName || null,
        imageUrl: person?.imageUrl || null,
        type: isStudent ? 'STUDENT' : 'PLAYER',
      },
      author: incident.createdBy
        ? {
            id: incident.createdBy.id,
            email: incident.createdBy.email,
            name: incident.createdBy.person
              ? `${incident.createdBy.person.name} ${incident.createdBy.person.lastName}`
              : null,
          }
        : null,
    };
  }

  /**
   * Actualiza la descripción de un incidente respetando autoría (Requirement 30).
   */
  async updateGroupSessionIncident(
    user: AuthenticatedUserContext,
    type: string,
    groupId: string,
    sessionId: string,
    incidentId: string,
    dto: TeacherUpdateIncidentDto,
  ): Promise<TeacherIncidentItemDto> {
    await this.getGroupSession(user, type, groupId, sessionId);

    const incident = await this.prisma.sessionIncident.findUnique({
      where: { id: incidentId },
      include: {
        sessionBooking: {
          include: {
            student: {
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
            },
            player: {
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
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            person: { select: { name: true, lastName: true } },
          },
        },
      },
    });

    if (!incident || incident.sessionBooking.sessionId !== sessionId) {
      throw new NotFoundException('El incidente no fue encontrado en esta sesión.');
    }

    const isAuthor = incident.createdById === user.id;
    const isAdmin =
      user.role?.name === 'SUPER_ADMIN' ||
      user.permissions?.includes('ADMIN') ||
      false;

    if (!isAuthor && !isAdmin && incident.createdById) {
      throw new ForbiddenException('Solo el creador del reporte de incidente tiene autorización para editarlo.');
    }

    const updated = await this.prisma.sessionIncident.update({
      where: { id: incidentId },
      data: {
        description: dto.description.trim(),
        updatedById: user.id,
      },
      include: {
        sessionBooking: {
          include: {
            student: {
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
            },
            player: {
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
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            person: { select: { name: true, lastName: true } },
          },
        },
      },
    });

    const b = updated.sessionBooking;
    const isStudent = !!b.student;
    const person = isStudent ? b.student?.person : b.player?.person;
    const participantId = isStudent ? b.studentId! : b.playerId!;

    return {
      id: updated.id,
      sessionBookingId: updated.sessionBookingId,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      createdById: updated.createdById,
      canEdit: true,
      participant: {
        id: participantId,
        name: person?.name || '',
        lastName: person?.lastName || '',
        secondLastName: person?.secondLastName || null,
        imageUrl: person?.imageUrl || null,
        type: isStudent ? 'STUDENT' : 'PLAYER',
      },
      author: updated.createdBy
        ? {
            id: updated.createdBy.id,
            email: updated.createdBy.email,
            name: updated.createdBy.person
              ? `${updated.createdBy.person.name} ${updated.createdBy.person.lastName}`
              : null,
          }
        : null,
    };
  }

  /**
   * Retorna las ubicaciones físicas activas del club disponibles para programar sesiones.
   */
  async getAvailableLocations(): Promise<
    { id: string; name: string; address?: string | null }[]
  > {
    return this.prisma.location.findMany({
      select: { id: true, name: true, address: true },
      orderBy: { name: 'asc' },
    });
  }
}


