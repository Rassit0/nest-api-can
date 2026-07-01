import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateProgressEvaluationDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del jugador evaluado (si es del club)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'playerId',
    }),
  })
  @Exists('player', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'playerId',
    }),
  })
  playerId?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del estudiante evaluado (si es de la escuela)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'studentId',
    }),
  })
  @Exists('student', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'studentId',
    }),
  })
  studentId?: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del evaluador (Staff/Profesor)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'evaluatorStaffId',
    }),
  })
  @Exists('staff', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'evaluatorStaffId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'evaluatorStaffId',
    }),
  })
  evaluatorStaffId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada evaluada (Season)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'seasonId',
    }),
  })
  @Exists('season', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'seasonId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'seasonId',
    }),
  })
  seasonId: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha en la que se realiza la evaluación',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'evaluationDate',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'evaluationDate',
    }),
  })
  @Type(() => Date)
  evaluationDate: Date;

  @ApiPropertyOptional({
    example: 85,
    description: 'Calificación del aspecto técnico (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'technicalScore',
    }),
  })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  technicalScore?: number;

  @ApiPropertyOptional({
    example: 78,
    description: 'Calificación del aspecto táctico (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'tacticalScore',
    }),
  })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  tacticalScore?: number;

  @ApiPropertyOptional({
    example: 90,
    description: 'Calificación del aspecto físico (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'physicalScore',
    }),
  })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  physicalScore?: number;

  @ApiPropertyOptional({
    example: 95,
    description: 'Calificación del aspecto conductual/actitudinal (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'behaviorScore',
    }),
  })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  behaviorScore?: number;

  @ApiPropertyOptional({
    example:
      'Excelente evolución física, mejora constante en resistencia táctica.',
    description: 'Comentarios o retroalimentación cualitativa',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'notes',
    }),
  })
  notes?: string | null;
}
