import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class FinalizeTeamSeasonDto {
  @ApiProperty({
    description: 'Razón o notas sobre la finalización de la temporada del equipo',
    example: 'Temporada terminada con éxito y sin deudas.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
