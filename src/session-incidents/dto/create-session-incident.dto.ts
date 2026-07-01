import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateSessionIncidentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la reserva/asistencia de la sesión (SessionBooking)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'sessionBookingId',
    }),
  })
  @Exists('sessionBooking', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'sessionBookingId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'sessionBookingId',
    }),
  })
  sessionBookingId: string;

  @ApiProperty({
    example: 'Insultó a un compañero de equipo durante la práctica',
    description:
      'Descripción de la actitud negativa o incidente de mala conducta',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'description',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description: string;
}
