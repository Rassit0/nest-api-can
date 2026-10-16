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

export class TeacherCreateEvaluationDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del participante (studentId para COURSE, playerId para TEAM)',
  })
  @IsUUID('4', { message: 'El ID del participante debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del participante es obligatorio' })
  participantId: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha en la que se realiza la evaluación (ISO 8601)',
  })
  @IsNotEmpty({ message: 'La fecha de evaluación es obligatoria' })
  @IsDate({ message: 'La fecha de evaluación debe ser una fecha válida' })
  @Type(() => Date)
  evaluationDate: Date;

  @ApiPropertyOptional({
    example: 85,
    description: 'Calificación técnica (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje técnico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  technicalScore?: number;

  @ApiPropertyOptional({
    example: 78,
    description: 'Calificación táctica (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje táctico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  tacticalScore?: number;

  @ApiPropertyOptional({
    example: 90,
    description: 'Calificación física (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje físico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  physicalScore?: number;

  @ApiPropertyOptional({
    example: 95,
    description: 'Calificación de conducta/actitud (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje de conducta debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  behaviorScore?: number;

  @ApiPropertyOptional({
    example: 'Excelente progresión y actitud en los entrenamientos.',
    description: 'Notas o retroalimentación cualitativa',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  notes?: string;
}

export class TeacherUpdateEvaluationDto {
  @ApiPropertyOptional({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Fecha en la que se realiza la evaluación (ISO 8601)',
  })
  @IsOptional()
  @IsDate({ message: 'La fecha de evaluación debe ser una fecha válida' })
  @Type(() => Date)
  evaluationDate?: Date;

  @ApiPropertyOptional({
    example: 85,
    description: 'Calificación técnica (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje técnico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  technicalScore?: number;

  @ApiPropertyOptional({
    example: 78,
    description: 'Calificación táctica (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje táctico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  tacticalScore?: number;

  @ApiPropertyOptional({
    example: 90,
    description: 'Calificación física (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje físico debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  physicalScore?: number;

  @ApiPropertyOptional({
    example: 95,
    description: 'Calificación de conducta/actitud (0 a 100)',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'El puntaje de conducta debe ser un número entero' })
  @Min(0, { message: 'El puntaje mínimo es 0' })
  @Max(100, { message: 'El puntaje máximo es 100' })
  @Type(() => Number)
  behaviorScore?: number;

  @ApiPropertyOptional({
    example: 'Excelente progresión y actitud en los entrenamientos.',
    description: 'Notas o retroalimentación cualitativa',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  notes?: string;
}

export class TeacherEvaluationEvaluatorDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Prof. Carlos Mendoza' })
  displayName: string;
}

export class TeacherEvaluationItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '2026-06-30T00:00:00.000Z' })
  evaluationDate: Date;

  @ApiPropertyOptional({ example: 85, nullable: true })
  technicalScore: number | null;

  @ApiPropertyOptional({ example: 78, nullable: true })
  tacticalScore: number | null;

  @ApiPropertyOptional({ example: 90, nullable: true })
  physicalScore: number | null;

  @ApiPropertyOptional({ example: 95, nullable: true })
  behaviorScore: number | null;

  @ApiPropertyOptional({ example: 'Comentarios.', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  participantId: string;

  @ApiProperty({ example: 'Pérez Gómez, Juan' })
  participantName: string;

  @ApiProperty({ type: TeacherEvaluationEvaluatorDto })
  evaluator: TeacherEvaluationEvaluatorDto;

  @ApiProperty({ example: true, description: 'True si el usuario autenticado puede editar esta evaluación' })
  canEdit: boolean;
}

export class TeacherGroupEvaluationsResponseDto {
  @ApiProperty({ type: [TeacherEvaluationItemDto] })
  evaluations: TeacherEvaluationItemDto[];

  @ApiProperty({ example: 5 })
  total: number;
}
