import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type TeacherGroupType = 'COURSE' | 'TEAM';

export class TeacherGroupDto {
  @ApiProperty({
    enum: ['COURSE', 'TEAM'],
    example: 'COURSE',
    description:
      'Tipo de grupo (COURSE para Escuela / TEAM para Equipo competitivo)',
  })
  type: TeacherGroupType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID canónico del grupo operativo (courseSeasonShiftId o teamSeasonCategoryId)',
  })
  groupId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID del contenedor superior (courseSeasonId o teamSeasonId)',
  })
  parentId: string;

  @ApiProperty({
    example: 'Escuela de Básquetbol',
    description: 'Nombre del curso o del equipo',
  })
  name: string;

  @ApiProperty({
    example: 'Turno Tarde (16:00 - 17:30)',
    description: 'Detalle descriptivo del turno o categoría',
  })
  detail: string;

  @ApiProperty({
    example: 'U13',
    description: 'Nombre de la categoría asignada',
  })
  category: string;

  @ApiPropertyOptional({
    example: 'Tarde',
    description: 'Nombre del turno (solo para cursos escolares)',
    nullable: true,
  })
  shift?: string | null;

  @ApiPropertyOptional({
    example: 'MIXED',
    description: 'Género del grupo (MALE, FEMALE, MIXED)',
    nullable: true,
  })
  gender?: string | null;

  @ApiProperty({
    example: 'HEAD_COACH',
    description: 'Rol asignado en el cuerpo técnico',
  })
  role: string;

  @ApiPropertyOptional({
    example: 'Entrenador Principal',
    description: 'Rol personalizado opcional',
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
    description:
      'Cantidad de participantes vigentes (alumnos con ciclo activo en fecha o jugadores activos)',
  })
  participantCount: number;

  @ApiProperty({
    example: 30,
    description:
      'Cantidad total de membresías administrativas activas en el turno/categoría',
  })
  administrativeCount: number;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Fecha de inicio de la asignación del profesor al grupo',
  })
  startedAt: Date;

  @ApiPropertyOptional({
    example: null,
    description: 'Fecha de finalización de la asignación del profesor, si aplica',
    nullable: true,
  })
  endedAt?: Date | null;
}

export class StaffPersonSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  id: string;

  @ApiProperty({ example: 'Juan' })
  name: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiPropertyOptional({ example: 'Gómez', nullable: true })
  secondLastName?: string | null;

  @ApiPropertyOptional({ example: 'https://...', nullable: true })
  imageUrl?: string | null;
}

export class MyGroupsResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'ID de la entidad Staff vinculada al usuario',
  })
  staffId: string;

  @ApiProperty({
    type: StaffPersonSummaryDto,
    description: 'Datos básicos de la persona vinculada al Staff',
  })
  person: StaffPersonSummaryDto;

  @ApiProperty({
    type: [TeacherGroupDto],
    description: 'Lista unificada de grupos activos asignados',
  })
  groups: TeacherGroupDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el usuario tiene alcance de supervisión global sobre todos los grupos',
    nullable: true,
  })
  isSupervisor?: boolean;
}
