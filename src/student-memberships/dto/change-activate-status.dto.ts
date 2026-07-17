import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class ChangeActivateStatusDto {
  @ApiPropertyOptional({
    example:
      'El estudiante no ha asistido a las sesiones durante tres meses consecutivos',
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
  @IsOptional()
  reason?: string;
}
