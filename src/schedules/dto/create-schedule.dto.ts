import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { DayOfWeek } from 'src/generated/prisma/client';

export class CreateScheduleDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada del equipo (TeamSeason)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamSeasonId',
    }),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  teamSeasonId: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del lugar de entrenamiento (Location)',
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

  @ApiProperty({
    enum: DayOfWeek,
    example: DayOfWeek.MONDAY,
    description: 'Día de la semana para el entrenamiento',
  })
  @IsEnum(DayOfWeek, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'dayOfWeek',
    }),
  })
  dayOfWeek: DayOfWeek;

  @ApiProperty({
    example: '18:00',
    description: 'Hora de inicio (Formato HH:MM)',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'startTime',
    }),
  })
  @Matches(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'La hora de inicio debe estar en formato HH:MM (de 00:00 a 23:59)',
  })
  startTime: string;

  @ApiProperty({
    example: '19:30',
    description: 'Hora de fin (Formato HH:MM)',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'endTime',
    }),
  })
  @Matches(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'La hora de fin debe estar en formato HH:MM (de 00:00 a 23:59)',
  })
  endTime: string;
}
