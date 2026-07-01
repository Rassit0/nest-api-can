import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateSessionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del lugar de entrenamiento/clase (Location)',
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
    example: 'Entrenamiento de Resistencia',
    description: 'Título de la sesión',
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
    example: '2026-06-30T18:00:00.000Z',
    description: 'Fecha y hora de la sesión',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'dateTime',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'dateTime',
    }),
  })
  @Type(() => Date)
  dateTime: Date;

  @ApiPropertyOptional({
    example: 90,
    description: 'Duración en minutos de la sesión',
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

  @ApiPropertyOptional({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'Arreglo de IDs de temporadas de equipos asociados (TeamSeason)',
  })
  @IsOptional()
  @IsArray({
    message: 'teamSeasonIds debe ser un arreglo',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada elemento de teamSeasonIds debe ser un UUID válido',
  })
  teamSeasonIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'Arreglo de IDs de temporadas de cursos de escuelas asociados (CourseSeason)',
  })
  @IsOptional()
  @IsArray({
    message: 'courseSeasonIds debe ser un arreglo',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada elemento de courseSeasonIds debe ser un UUID válido',
  })
  courseSeasonIds?: string[];
}
