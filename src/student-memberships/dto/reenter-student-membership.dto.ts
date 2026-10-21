import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReenterStudentMembershipDto {
  @ApiProperty({
    description: 'Fecha efectiva de reingreso en formato ISO 8601 (UTC)',
    example: '2026-10-21T00:00:00.000Z',
  })
  @IsNotEmpty({ message: 'La fecha efectiva de reingreso es requerida' })
  @IsISO8601(
    { strict: true },
    {
      message:
        'effectiveDate debe ser una fecha válida en formato ISO 8601 (UTC)',
    },
  )
  effectiveDate: string;

  @ApiProperty({
    description: 'Motivo u observación administrativa del reingreso',
    example: 'Reincorporación del estudiante tras retiro voluntario por viaje',
  })
  @IsNotEmpty({ message: 'El motivo de reingreso es obligatorio' })
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @MinLength(5, {
    message: 'El motivo debe tener al menos 5 caracteres descriptivos',
  })
  @MaxLength(500, {
    message: 'El motivo no puede exceder los 500 caracteres',
  })
  reason: string;

  @ApiPropertyOptional({
    description:
      'ID del turno al que reingresa el estudiante. Si se omite, se mantiene el turno actual de la membresía.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'courseSeasonShiftId debe ser un UUID válido' })
  courseSeasonShiftId?: string;

  @ApiPropertyOptional({
    description: 'Notas administrativas adicionales para el expediente',
    example: 'Autorizado por coordinación deportiva CAN',
  })
  @IsOptional()
  @IsString({ message: 'Las notas deben ser una cadena de texto' })
  @MaxLength(500, { message: 'Las notas no pueden exceder los 500 caracteres' })
  notes?: string;
}
