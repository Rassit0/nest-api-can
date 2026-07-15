import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FinalizeCourseSeasonDto {
  @ApiProperty({
    description: 'Razón o notas sobre la finalización del periodo de curso',
    example: 'Curso terminado con éxito.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
