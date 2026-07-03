import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsISO8601, IsUUID, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreatePlayerMembershipDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID del jugador al que pertenece esta membresía de jugador a equipo',
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

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID de la oferta de membresía de equipo a la que pertenece esta membresía de jugador',
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

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del plan de pago de la oferta de membresia de equiop',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'paymentPlanId',
    }),
  })
  @Exists('paymentPlan', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'paymentPlanId',
    }),
  })
  paymentPlanId: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de inicio de la temporada (formato ISO 8601)',
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startedAt: string;

  @ApiProperty({
    example: true,
    description: 'Indica si la membresía fue migrada',
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN'),
  })
  isMigrated: boolean;

  // @ApiProperty({
  //     example: PlayerMembershipStatus.ACTIVE,
  //     enum: PlayerMembershipStatus,
  //     description: 'Estado de la membresía de jugador a equipo (ACTIVE, SUSPENDED, WITHDRAWN)',
  // })
  // @IsEnum(PlayerMembershipStatus, {
  //     message: i18nValidationMessage('validation.IS_ENUM', {
  //         constraint1: 'status',
  //     }),
  // })
  // status: PlayerMembershipStatus;
}
