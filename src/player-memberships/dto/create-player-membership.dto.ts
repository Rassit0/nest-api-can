import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsISO8601, IsUUID, Max, Min, ValidateNested, IsOptional, IsArray, IsNumber, IsDateString, IsEnum, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { Type } from 'class-transformer';
import { MembershipDiscountType } from 'src/generated/prisma/client';

export class MembershipDiscountDto {
  @ApiProperty({ description: 'Porcentaje de descuento en la matrícula', example: 10 })
  @IsNumber()
  registrationDiscountPercent: number;

  @ApiProperty({ description: 'Porcentaje de descuento en la mensualidad', example: 15 })
  @IsNumber()
  recurringDiscountPercent: number;

  @ApiProperty({ description: 'Fecha de inicio del descuento', example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del descuento', example: '2024-12-31', nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiProperty({ description: 'Tipo de descuento', enum: MembershipDiscountType })
  @IsEnum(MembershipDiscountType)
  type: MembershipDiscountType;

  @ApiPropertyOptional({ description: 'Razón del descuento', example: 'Descuento especial', nullable: true })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

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

  @ApiPropertyOptional({
    description: 'Lista de descuentos excepcionales aplicables a la membresía',
    type: () => [MembershipDiscountDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MembershipDiscountDto)
  membershipDiscounts?: MembershipDiscountDto[];

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
