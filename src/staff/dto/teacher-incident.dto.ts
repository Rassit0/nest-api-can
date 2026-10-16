import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class TeacherCreateIncidentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del participante (Student o Player) asociado al incidente',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'participantId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'participantId',
    }),
  })
  participantId: string;

  @ApiProperty({
    example: 'Llegó con retraso y mostró actitud desafiante durante el calentamiento',
    description: 'Descripción del incidente de conducta u observación disciplinaria',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'description',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description: string;
}

export class TeacherUpdateIncidentDto {
  @ApiProperty({
    example: 'Descripción actualizada de la observación de conducta',
    description: 'Descripción rectificada del reporte disciplinario',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'description',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description: string;
}

export class TeacherIncidentParticipantDto {
  @ApiProperty({ description: 'ID del estudiante o jugador', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Nombre de pila' })
  name: string;

  @ApiProperty({ description: 'Apellidos' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Segundo apellido', nullable: true })
  secondLastName?: string | null;

  @ApiPropertyOptional({ description: 'Foto de perfil', nullable: true })
  imageUrl?: string | null;

  @ApiProperty({ description: 'Tipo de participante', enum: ['STUDENT', 'PLAYER'] })
  type: 'STUDENT' | 'PLAYER';
}

export class TeacherIncidentAuthorDto {
  @ApiProperty({ description: 'ID del usuario creador', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Email del creador' })
  email: string;

  @ApiPropertyOptional({ description: 'Nombre del docente', nullable: true })
  name?: string | null;
}

export class TeacherIncidentItemDto {
  @ApiProperty({ description: 'ID del incidente', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ID de la reserva de sesión asociada', format: 'uuid' })
  sessionBookingId: string;

  @ApiProperty({ description: 'Descripción del incidente u observación' })
  description: string;

  @ApiProperty({ description: 'Fecha y hora de registro' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha y hora de última actualización' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'ID del usuario creador', nullable: true })
  createdById?: string | null;

  @ApiProperty({ description: 'Datos del participante asociado', type: TeacherIncidentParticipantDto })
  participant: TeacherIncidentParticipantDto;

  @ApiPropertyOptional({ description: 'Datos del docente autor', type: TeacherIncidentAuthorDto, nullable: true })
  author?: TeacherIncidentAuthorDto | null;

  @ApiProperty({ description: 'Indica si el usuario actual puede editar este reporte' })
  canEdit: boolean;
}

export class TeacherSessionIncidentsResponseDto {
  @ApiProperty({ description: 'Lista de incidentes reportados en la sesión', type: [TeacherIncidentItemDto] })
  incidents: TeacherIncidentItemDto[];

  @ApiProperty({ description: 'Total de incidentes' })
  total: number;
}
