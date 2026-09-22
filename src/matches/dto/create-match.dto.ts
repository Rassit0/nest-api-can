import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  IsISO8601,
  IsString,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { MatchType } from 'src/generated/prisma/client';

export class CreateMatchDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría de la temporada del equipo local (TeamSeasonCategory)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'homeTeamSeasonCategoryId',
    }),
  })
  @Exists('teamSeasonCategory', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'homeTeamSeasonCategoryId',
    }),
  })
  homeTeamSeasonCategoryId?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría de la temporada del equipo visitante (TeamSeasonCategory)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'awayTeamSeasonCategoryId',
    }),
  })
  @Exists('teamSeasonCategory', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'awayTeamSeasonCategoryId',
    }),
  })
  awayTeamSeasonCategoryId?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la instalación donde se juega el partido (Location)',
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
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'ID del equipo local (Team)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'homeTeamId',
    }),
  })
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'homeTeamId',
    }),
  })
  homeTeamId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'ID del equipo visitante (Team)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'awayTeamId',
    }),
  })
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'awayTeamId',
    }),
  })
  awayTeamId: string;

  @ApiProperty({
    example: '2026-06-30T15:00:00.000Z',
    description: 'Fecha y hora del partido',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'startDate',
    }),
  })
  @IsISO8601({ strict: true }, {
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'startDate',
    }),
  })
  startDate: string;

  @ApiProperty({
    example: '2026-06-30T17:00:00.000Z',
    description: 'Fecha y hora de fin del partido',
  })
  @IsNotEmpty()
  @IsISO8601({ strict: true })
  endDate: string;

  @ApiProperty({
    enum: MatchType,
    example: MatchType.LEAGUE,
    description: 'Tipo de partido (FRIENDLY, LEAGUE, TOURNAMENT, CUP)',
    default: MatchType.LEAGUE,
  })
  @IsEnum(MatchType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'type',
    }),
  })
  type: MatchType;

  @ApiPropertyOptional({
    example: 2,
    description: 'Marcador del equipo local',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'homeScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'homeScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  homeScore?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Marcador del equipo visitante',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'awayScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'awayScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  awayScore?: number | null;

  @ApiPropertyOptional({
    example: 'Liga Municipal 2026',
    description: 'Nombre opcional de la competición o torneo',
  })
  @IsOptional()
  @IsString()
  competitionName?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'ID del staff que actúa como entrenador local',
  })
  @IsOptional()
  @IsUUID('4')
  @Exists('staff', 'id')
  homeCoachId?: string | null;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre del entrenador local (solo para rivales externos sin Staff en DB)',
  })
  @IsOptional()
  @IsString()
  homeCoachName?: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440004',
    description: 'ID del staff que actúa como entrenador visitante',
  })
  @IsOptional()
  @IsUUID('4')
  @Exists('staff', 'id')
  awayCoachId?: string | null;

  @ApiPropertyOptional({
    example: 'Carlos López',
    description: 'Nombre del entrenador visitante (solo para rivales externos sin Staff en DB)',
  })
  @IsOptional()
  @IsString()
  awayCoachName?: string | null;
}
