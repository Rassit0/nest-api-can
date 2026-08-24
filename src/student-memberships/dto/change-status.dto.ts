import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { StudentMembershipSuspensionReason } from 'src/generated/prisma/client';

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

  @ApiProperty({
    enum: StudentMembershipSuspensionReason,
    description: 'Motivo estructurado de la suspensión',
    required: false,
  })
  @IsOptional()
  @IsEnum(StudentMembershipSuspensionReason, {
    message: 'El motivo de suspensión debe ser un valor válido',
  })
  suspensionReason?: StudentMembershipSuspensionReason;
}
