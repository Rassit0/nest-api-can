import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateMatchLineupDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del partido (Match)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'matchId',
    }),
  })
  @Exists('match', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'matchId',
    }),
  })
  matchId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del jugador (Player)',
  })
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
  playerId: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Minutos jugados en el partido',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minutesPlayed',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minutesPlayed',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  minutesPlayed?: number = 0;

  @ApiPropertyOptional({
    example: 1,
    description: 'Goles marcados por el jugador',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'goals',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'goals',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  goals?: number = 0;

  @ApiPropertyOptional({
    example: 2,
    description: 'Asistencias dadas por el jugador',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'assists',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'assists',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  assists?: number = 0;

  @ApiPropertyOptional({
    example: 0,
    description: 'Tarjetas amarillas recibidas',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'yellowCards',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'yellowCards',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  yellowCards?: number = 0;

  @ApiPropertyOptional({
    example: 0,
    description: 'Tarjetas rojas recibidas',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'redCards',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'redCards',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  redCards?: number = 0;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si el jugador inició el partido como titular',
    default: false,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isStarter',
    }),
  })
  @Type(() => Boolean)
  isStarter?: boolean = false;
}
