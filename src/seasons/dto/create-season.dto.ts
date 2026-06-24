import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';

export class CreateSeasonDto {
  @ApiProperty({
    example: 'Temporada 2024',
    description: 'Nombre de la temporada',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  name: string;

  @ApiProperty({
    example: 'Temporada para el año 2024',
    description: 'Descripción de la temporada',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de inicio de la temporada (formato ISO 8601)',
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startDate: string;

  @ApiProperty({
    example: '2024-12-31T23:59:59.000Z',
    description: 'Fecha de fin de la temporada (formato ISO 8601)',
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  // Validacion para que la fecha final sea mayor a la inicial
  @IsAfter('startDate', {
    message: i18nValidationMessage('validation.IS_AFTER_START_DATE'),
  })
  endDate: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la institución',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'institutionId',
    }),
  })
  @Exists('institution', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'institutionId',
    }),
  })
  institutionId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la disciplina',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'disciplineId',
    }),
  })
  @Exists('discipline', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'disciplineId',
    }),
  })
  disciplineId: string;
}
