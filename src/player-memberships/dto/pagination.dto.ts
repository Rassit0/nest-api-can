// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { PlayerMembershipStatus } from '../../generated/prisma/enums';

export class PlayerMembershipsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['startedAt', 'endedAt', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'endedAt', 'createdAt', 'id'], {
    message: i18nValidationMessage('validation.IS_IN', {
      validValues: 'createdAt, id',
    }),
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por jugador',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('player', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'playerId',
    }),
  })
  @IsOptional()
  playerId: string;

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por oferta de membresía de equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  @IsOptional()
  teamSeasonId: string;

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por plan de pago',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('paymentPlan', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'paymentPlanId',
    }),
  })
  @IsOptional()
  paymentPlanId: string;

  @ApiPropertyOptional({
    // example: 'name',
    enum: PlayerMembershipStatus,
    description:
      'Filtrar por estado de la membresía del jugador (ACTIVE, SUSPENDED, WITHDRAWN)',
  })
  @IsEnum(PlayerMembershipStatus, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'PlayerMembershipStatus',
    }),
  })
  @IsOptional()
  status?: PlayerMembershipStatus;
}
