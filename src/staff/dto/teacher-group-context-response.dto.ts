import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherGroupType } from './my-groups-response.dto';

export class TeacherParticipantDto {
  @ApiProperty({
    enum: ['STUDENT', 'PLAYER'],
    example: 'STUDENT',
    description: 'Tipo de participante (STUDENT o PLAYER)',
  })
  type: 'STUDENT' | 'PLAYER';

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID de la entidad Student o Player',
  })
  participantId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'ID de la entidad Person vinculada',
  })
  personId: string;

  @ApiProperty({
    example: 'Mateo',
    description: 'Nombre de pila del participante',
  })
  firstName: string;

  @ApiProperty({
    example: 'García',
    description: 'Primer apellido',
  })
  lastName: string;

  @ApiPropertyOptional({
    example: 'López',
    description: 'Segundo apellido',
    nullable: true,
  })
  secondLastName?: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'ID de la membresía activa (StudentMembership o PlayerMembership)',
  })
  membershipId: string;

  @ApiPropertyOptional({
    example: 'https://cdn.can.edu.bo/photos/123.jpg',
    description: 'URL de la foto de perfil del participante',
    nullable: true,
  })
  imageUrl?: string | null;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Estado de la membresía/inscripción',
  })
  status: string;

  @ApiPropertyOptional({
    example: '12345678',
    description: 'Número de documento de identidad',
    nullable: true,
  })
  documentNumber?: string | null;

  @ApiPropertyOptional({
    example: '2012-05-14T00:00:00.000Z',
    description: 'Fecha de nacimiento',
    nullable: true,
  })
  birthDate?: Date | null;
}

export class TeacherGroupSessionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description: 'ID de la sesión de entrenamiento',
  })
  id: string;

  @ApiProperty({
    example: 'event-uuid-123',
    description: 'ID del evento en el calendario',
  })
  eventId: string;

  @ApiProperty({
    example: 'Entrenamiento Táctico',
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
    description: 'Fecha y hora de finalización de la sesión',
  })
  endDate: Date;

  @ApiProperty({
    example: 90,
    description: 'Duración estimada en minutos',
  })
  durationMin: number;

  @ApiPropertyOptional({
    example: { id: 'loc-1', name: 'Cancha Central', address: 'Av. Costanera #45' },
    description: 'Ubicación de la sesión',
    nullable: true,
  })
  location?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;

  @ApiProperty({
    example: 'SCHEDULED',
    description: 'Estado canónico del evento (Event.status)',
  })
  status: string;
}

export class TeacherGroupContextResponseDto {
  @ApiProperty({
    enum: ['COURSE', 'TEAM'],
    example: 'COURSE',
    description: 'Tipo de grupo asignado (COURSE o TEAM)',
  })
  type: TeacherGroupType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID operativo del grupo (courseSeasonShiftId o teamSeasonCategoryId)',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440099',
    description: 'ID de la temporada padre (courseSeasonId o teamSeasonId)',
  })
  parentId: string;

  @ApiProperty({
    example: 'Básquetbol U13',
    description: 'Nombre del curso o equipo',
  })
  name: string;

  @ApiProperty({
    example: 'Turno Tarde (U13)',
    description: 'Detalle contextual del turno o categoría',
  })
  detail: string;

  @ApiProperty({
    example: 'U13',
    description: 'Nombre de la categoría',
  })
  category: string;

  @ApiPropertyOptional({
    example: 'Turno Tarde',
    description: 'Nombre del turno para cursos escolares',
    nullable: true,
  })
  shift?: string | null;

  @ApiPropertyOptional({
    example: 'MIXED',
    description: 'Género del programa o categoría',
    nullable: true,
  })
  gender?: string | null;

  @ApiProperty({
    example: 'HEAD_COACH',
    description: 'Rol del Staff asignado',
  })
  role: string;

  @ApiPropertyOptional({
    example: null,
    description: 'Rol personalizado asignado',
    nullable: true,
  })
  customRole?: string | null;

  @ApiProperty({
    example: true,
    description: 'Indica si es el profesor/entrenador principal del grupo',
  })
  isPrimary: boolean;

  @ApiProperty({
    example: 24,
    description: 'Cantidad de participantes activos/vigentes en el grupo',
  })
  participantCount: number;

  @ApiProperty({
    example: 24,
    description: 'Cantidad de inscripciones administrativas activas',
  })
  administrativeCount: number;

  @ApiPropertyOptional({
    example: {
      courseSeasonId: 'cs-1',
      courseId: 'c-1',
      shiftId: 's-1',
      shiftName: 'Turno Tarde',
    },
    description: 'Metadatos específicos si el tipo es COURSE',
    nullable: true,
  })
  course?: {
    courseSeasonId: string;
    courseId: string;
    shiftId: string;
    shiftName: string;
  } | null;

  @ApiPropertyOptional({
    example: {
      teamSeasonId: 'ts-1',
      teamId: 't-1',
    },
    description: 'Metadatos específicos si el tipo es TEAM',
    nullable: true,
  })
  team?: {
    teamSeasonId: string;
    teamId: string;
  } | null;

  @ApiPropertyOptional({
    type: [TeacherParticipantDto],
    description: 'Roster canónico de participantes del grupo (solo si tiene permisos de lectura)',
    nullable: true,
  })
  participants?: TeacherParticipantDto[];

  @ApiPropertyOptional({
    type: [TeacherGroupSessionDto],
    description: 'Próximas sesiones programadas para este grupo (solo con permiso READ_SESSIONS)',
    nullable: true,
  })
  upcomingSessions?: TeacherGroupSessionDto[];

  @ApiPropertyOptional({
    type: [TeacherGroupSessionDto],
    description: 'Sesiones recientes ya concluidas para este grupo (solo con permiso READ_SESSIONS)',
    nullable: true,
  })
  recentSessions?: TeacherGroupSessionDto[];
}
