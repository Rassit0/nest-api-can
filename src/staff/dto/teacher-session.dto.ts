import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class TeacherCreateSessionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la ubicación física (cancha o recinto)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'locationId',
    }),
  })
  @Exists('location', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'locationId',
    }),
  })
  locationId?: string | null;

  @ApiPropertyOptional({
    example: 'Entrenamiento Táctico',
    description: 'Título descriptivo de la sesión de entrenamiento',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'title',
    }),
  })
  title?: string | null;

  @ApiProperty({
    example: '2026-10-20T17:00:00.000Z',
    description: 'Fecha y hora de inicio de la sesión en formato ISO 8601',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'startDate',
    }),
  })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      message: i18nValidationMessage('validation.IS_ISO8601', {
        constraint1: 'startDate',
      }),
    },
  )
  startDate: string;

  @ApiProperty({
    example: '2026-10-20T18:30:00.000Z',
    description: 'Fecha y hora de finalización de la sesión en formato ISO 8601',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'endDate',
    }),
  })
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      message: i18nValidationMessage('validation.IS_ISO8601', {
        constraint1: 'endDate',
      }),
    },
  )
  endDate: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Duración estimada en minutos de la sesión',
    default: 90,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'durationMin',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'durationMin',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  durationMin?: number = 90;
}

export class TeacherUpdateSessionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la ubicación física (cancha o recinto)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'locationId',
    }),
  })
  @Exists('location', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'locationId',
    }),
  })
  locationId?: string | null;

  @ApiPropertyOptional({
    example: 'Entrenamiento Táctico Modificado',
    description: 'Título descriptivo de la sesión de entrenamiento',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'title',
    }),
  })
  title?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-20T17:00:00.000Z',
    description: 'Fecha y hora de inicio de la sesión en formato ISO 8601',
  })
  @IsOptional()
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      message: i18nValidationMessage('validation.IS_ISO8601', {
        constraint1: 'startDate',
      }),
    },
  )
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-20T18:30:00.000Z',
    description: 'Fecha y hora de finalización de la sesión en formato ISO 8601',
  })
  @IsOptional()
  @IsISO8601(
    { strict: true, strictSeparator: true },
    {
      message: i18nValidationMessage('validation.IS_ISO8601', {
        constraint1: 'endDate',
      }),
    },
  )
  endDate?: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Duración estimada en minutos de la sesión',
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'durationMin',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'durationMin',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  durationMin?: number;

  @ApiPropertyOptional({
    example: 'CANCELLED',
    description: 'Estado del evento (SCHEDULED, COMPLETED, CANCELLED)',
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class TeacherSessionDetailDto {
  @ApiProperty({ description: 'ID de la sesión', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'ID del evento asociado', format: 'uuid' })
  eventId: string;

  @ApiProperty({ description: 'Título de la sesión' })
  title: string;

  @ApiProperty({ description: 'Fecha y hora de inicio' })
  startDate: Date;

  @ApiProperty({ description: 'Fecha y hora de finalización' })
  endDate: Date;

  @ApiProperty({ description: 'Duración estimada en minutos' })
  durationMin: number;

  @ApiProperty({ description: 'Estado del evento' })
  status: string;

  @ApiPropertyOptional({
    description: 'Ubicación física',
    nullable: true,
  })
  location?: {
    id: string;
    name: string;
    address?: string | null;
  } | null;

  @ApiProperty({ description: 'Indica si ya existen asistencias registradas' })
  hasBookings: boolean;

  @ApiProperty({ description: 'Cantidad de asistencias registradas' })
  bookingsCount: number;
}
