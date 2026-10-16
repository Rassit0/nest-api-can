import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeacherGroupType } from './my-groups-response.dto';

export class AttendanceSessionLocationDto {
  @ApiProperty({ description: 'ID de la ubicación', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Nombre del recinto o cancha' })
  name: string;

  @ApiPropertyOptional({ description: 'Dirección o detalles del recinto' })
  address?: string | null;
}

export class AttendanceSessionContextDto {
  @ApiProperty({ description: 'ID de la sesión', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Título o nombre de la sesión' })
  title: string;

  @ApiProperty({ description: 'Fecha y hora de inicio de la sesión' })
  startDate: Date;

  @ApiProperty({ description: 'Fecha y hora de finalización de la sesión' })
  endDate: Date;

  @ApiProperty({ description: 'Duración en minutos' })
  durationMin: number;

  @ApiProperty({ description: 'Estado del evento' })
  status: string;

  @ApiPropertyOptional({
    description: 'Ubicación física',
    type: AttendanceSessionLocationDto,
    nullable: true,
  })
  location?: AttendanceSessionLocationDto | null;
}

export class AttendanceGroupContextDto {
  @ApiProperty({ description: 'Tipo de grupo', enum: ['COURSE', 'TEAM'] })
  type: TeacherGroupType;

  @ApiProperty({ description: 'ID del grupo operativo', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Nombre de la escuela o equipo' })
  name: string;

  @ApiProperty({ description: 'Detalle contextual del turno o categoría' })
  detail: string;

  @ApiPropertyOptional({ description: 'Categoría deportiva' })
  category?: string | null;

  @ApiPropertyOptional({ description: 'Nombre del turno si es curso' })
  shift?: string | null;
}

export class AttendanceIncidentDto {
  @ApiProperty({ description: 'ID del reporte de incidente', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Descripción de la observación o incidente' })
  description: string;

  @ApiProperty({ description: 'Fecha y hora de registro' })
  createdAt: Date;

  @ApiProperty({ description: 'Fecha y hora de última modificación' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'ID del usuario creador', nullable: true })
  createdById?: string | null;
}

export class AttendanceRecordDto {
  @ApiPropertyOptional({
    description: 'ID de la reserva existente en SessionBooking',
    format: 'uuid',
    nullable: true,
  })
  bookingId?: string | null;

  @ApiProperty({
    description:
      'Estado de asistencia: true (presente), false (ausente), null (no registrado aún)',
    nullable: true,
  })
  attended: boolean | null;

  @ApiPropertyOptional({
    description: 'Incidentes u observaciones disciplinarias asociadas a la reserva',
    type: [AttendanceIncidentDto],
  })
  incidents?: AttendanceIncidentDto[];
}

export class AttendanceParticipantDto {
  @ApiProperty({
    description: 'Tipo de participante en la plataforma',
    enum: ['STUDENT', 'PLAYER'],
  })
  participantType: 'STUDENT' | 'PLAYER';

  @ApiProperty({
    description: 'ID del participante (studentId o playerId)',
    format: 'uuid',
  })
  participantId: string;

  @ApiProperty({
    description: 'ID de la membresía activa correspondiente',
    format: 'uuid',
  })
  membershipId: string;

  @ApiProperty({ description: 'Nombre de pila' })
  firstName: string;

  @ApiProperty({ description: 'Primer apellido' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Segundo apellido', nullable: true })
  secondLastName?: string | null;

  @ApiPropertyOptional({ description: 'URL del avatar o foto de perfil', nullable: true })
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Número de documento de identidad', nullable: true })
  documentNumber?: string | null;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento', nullable: true })
  birthDate?: Date | null;

  @ApiProperty({
    description: 'Registro de asistencia para esta sesión',
    type: AttendanceRecordDto,
  })
  attendance: AttendanceRecordDto;
}

export class AttendanceSummaryDto {
  @ApiProperty({ description: 'Total de participantes en el roster de la sesión' })
  total: number;

  @ApiProperty({ description: 'Cantidad de participantes marcados como presentes' })
  present: number;

  @ApiProperty({ description: 'Cantidad de participantes marcados como ausentes' })
  absent: number;

  @ApiProperty({ description: 'Cantidad de participantes sin registrar aún' })
  unregistered: number;
}

export class SessionAttendanceRosterResponseDto {
  @ApiProperty({
    description: 'Contexto de la sesión seleccionada',
    type: AttendanceSessionContextDto,
  })
  session: AttendanceSessionContextDto;

  @ApiProperty({
    description: 'Contexto del grupo asignado',
    type: AttendanceGroupContextDto,
  })
  group: AttendanceGroupContextDto;

  @ApiProperty({
    description: 'Roster autorizado de participantes para la fecha de la sesión',
    type: [AttendanceParticipantDto],
  })
  participants: AttendanceParticipantDto[];

  @ApiProperty({
    description: 'Resumen cuantitativo de asistencia de la sesión',
    type: AttendanceSummaryDto,
  })
  summary: AttendanceSummaryDto;
}
