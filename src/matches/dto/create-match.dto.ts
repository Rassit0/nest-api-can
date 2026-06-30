import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { MatchResult, MatchType } from 'src/generated/prisma/client';

export class CreateMatchDto {
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
    example: 'Club Atlético Rival',
    description: 'Nombre del equipo rival',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'opponentName',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'opponentName',
    }),
  })
  opponentName: string;

  @ApiProperty({
    example: '2026-06-30T15:00:00.000Z',
    description: 'Fecha y hora del partido',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'matchDate',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'matchDate',
    }),
  })
  @Type(() => Date)
  matchDate: Date;

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
    description: 'Marcador de nuestro equipo',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'ourScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'ourScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  ourScore?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Marcador del equipo rival',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'theirScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'theirScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  theirScore?: number | null;

  @ApiPropertyOptional({
    enum: MatchResult,
    example: MatchResult.PENDING,
    description: 'Resultado del partido (WIN, LOSS, DRAW, PENDING)',
    default: MatchResult.PENDING,
  })
  @IsOptional()
  @IsEnum(MatchResult, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'result',
    }),
  })
  result?: MatchResult = MatchResult.PENDING;
}
