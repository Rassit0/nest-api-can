import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class CancelCycleEnrollmentDto {
  @ApiProperty({
    example: 'Inscripción errónea solicitada por el apoderado',
    description: 'Motivo obligatorio de la cancelación del ciclo',
  })
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo de cancelación es obligatorio' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  reason: string;
}
