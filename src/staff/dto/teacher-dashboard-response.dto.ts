import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffPersonSummaryDto, TeacherGroupDto, TeacherGroupType } from './my-groups-response.dto';

export class UpcomingSessionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description: 'ID de la sesión de entrenamiento',
  })
  id: string;

  @ApiProperty({
    example: 'Entrenamiento de Resistencia y Lanzamiento',
    description: 'Título descriptivo de la sesión',
  })
  title: string;

  @ApiProperty({
    example: '2026-10-16T17:30:00.000Z',
    description: 'Fecha y hora de inicio de la sesión',
  })
  startDate: Date;

  @ApiProperty({
    example: '2026-10-16T19:00:00.000Z',
    description: 'Fecha y hora de fin de la sesión',
  })
  endDate: Date;

  @ApiProperty({
    example: 90,
    description: 'Duración estimada en minutos',
  })
  durationMin: number;

  @ApiPropertyOptional({
    example: { id: 'loc-1', name: 'Cancha Principal', address: 'Av. Libertador #123' },
    description: 'Ubicación o instalación del entrenamiento',
    nullable: true,
  })
  location?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;

  @ApiProperty({
    enum: ['COURSE', 'TEAM'],
    example: 'COURSE',
    description: 'Tipo de grupo de la sesión (COURSE o TEAM)',
  })
  groupType: TeacherGroupType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del grupo asignado (courseSeasonShiftId o teamSeasonCategoryId)',
  })
  groupId: string;

  @ApiProperty({
    example: 'Básquetbol',
    description: 'Nombre del curso o equipo al que corresponde la sesión',
  })
  groupName: string;

  @ApiProperty({
    example: 'Turno Tarde (U13)',
    description: 'Detalle del turno o categoría',
  })
  groupDetail: string;
}

export class TeacherDashboardStatsDto {
  @ApiProperty({
    example: 3,
    description: 'Total de grupos activos asignados',
  })
  activeGroups: number;

  @ApiProperty({
    example: 2,
    description: 'Total de turnos de cursos escolares asignados',
  })
  courseGroups: number;

  @ApiProperty({
    example: 1,
    description: 'Total de categorías de equipos competitivos asignadas',
  })
  teamGroups: number;

  @ApiProperty({
    example: 42,
    description:
      'Total de participantes en ciclo activo vigente para escuelas o jugadores activos para equipos',
  })
  currentParticipants: number;

  @ApiProperty({
    example: 50,
    description: 'Total de membresías administrativas activas bajo su responsabilidad',
  })
  administrativeParticipants: number;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Cantidad de sesiones próximas programadas para sus grupos (presente solo si tiene permiso READ_SESSIONS)',
    nullable: true,
  })
  upcomingSessionsCount?: number;
}

export class TeacherDashboardResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'ID de la entidad Staff vinculada al usuario',
  })
  staffId: string;

  @ApiProperty({
    type: StaffPersonSummaryDto,
    description: 'Perfil de la persona vinculada',
  })
  person: StaffPersonSummaryDto;

  @ApiProperty({
    type: TeacherDashboardStatsDto,
    description: 'Métricas resumidas de actividad operativa del profesor',
  })
  stats: TeacherDashboardStatsDto;

  @ApiProperty({
    type: [TeacherGroupDto],
    description: 'Lista de grupos activos asignados',
  })
  groups: TeacherGroupDto[];

  @ApiPropertyOptional({
    type: [UpcomingSessionDto],
    description:
      'Próximas sesiones de los grupos del profesor (solo si tiene permiso READ_SESSIONS)',
    nullable: true,
  })
  upcomingSessions?: UpcomingSessionDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el usuario tiene alcance de supervisión global sobre todos los grupos',
    nullable: true,
  })
  isSupervisor?: boolean;
}
