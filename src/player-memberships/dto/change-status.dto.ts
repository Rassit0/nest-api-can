import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ChangeStatusDto {
  @ApiProperty({
    example:
      'El jugador no ha asistido a las sesiones durante tres meses consecutivos',
    description: 'Motivo del cambio de estado',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'reason',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'reason',
      constraint2: 3,
    }),
  })
  reason: string;
}
