import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateSessionBookingDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la sesión de entrenamiento (Session)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'sessionId',
    }),
  })
  @Exists('session', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'sessionId',
    }),
  })
  sessionId: string;

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
    example: false,
    description: 'Indica si es un participante externo que paga por clase',
    default: false,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isExternal',
    }),
  })
  @Type(() => Boolean)
  isExternal?: boolean = false;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si asistió al entrenamiento',
    default: false,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'attended',
    }),
  })
  @Type(() => Boolean)
  attended?: boolean = false;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del cobro asociado (Charge), solo si aplica',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'chargeId',
    }),
  })
  @Exists('charge', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'chargeId',
    }),
  })
  chargeId?: string | null;
}
