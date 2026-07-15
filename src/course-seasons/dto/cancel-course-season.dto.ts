import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelCourseSeasonDto {
  @ApiProperty({
    description: 'Razón o notas sobre la cancelación del periodo de curso',
    example: 'Cancelado por falta de inscritos.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
