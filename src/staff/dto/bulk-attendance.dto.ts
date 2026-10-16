import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BulkAttendanceEntryDto {
  @ApiProperty({
    description: 'ID del participante (studentId para cursos o playerId para equipos)',
    format: 'uuid',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsNotEmpty({ message: 'participantId no puede estar vacío' })
  @IsUUID('4', { message: 'participantId debe ser un UUID válido versión 4' })
  participantId: string;

  @ApiProperty({
    description: 'true si estuvo presente, false si estuvo ausente',
    example: true,
  })
  @IsBoolean({ message: 'attended debe ser un valor booleano (true o false)' })
  attended: boolean;
}

export class BulkAttendanceDto {
  @ApiProperty({
    description: 'Lista de registros de asistencia a guardar en bloque',
    type: [BulkAttendanceEntryDto],
  })
  @IsArray({ message: 'entries debe ser un arreglo de registros' })
  @ValidateNested({ each: true })
  @Type(() => BulkAttendanceEntryDto)
  entries: BulkAttendanceEntryDto[];
}

export class BulkAttendanceResponseDto {
  @ApiProperty({ description: 'ID de la sesión de entrenamiento', format: 'uuid' })
  sessionId: string;

  @ApiProperty({ description: 'ID del grupo operativo', format: 'uuid' })
  groupId: string;

  @ApiProperty({ description: 'Cantidad total de registros procesados' })
  savedCount: number;

  @ApiProperty({ description: 'Cantidad total de presentes guardados' })
  presentCount: number;

  @ApiProperty({ description: 'Cantidad total de ausentes guardados' })
  absentCount: number;
}
