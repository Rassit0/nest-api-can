import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelTeamSeasonDto {
  @ApiProperty({
    description: 'Razón o notas sobre la cancelación de la temporada del equipo',
    example: 'Cancelada por falta de inscritos.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
