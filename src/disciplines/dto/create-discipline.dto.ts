import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDisciplineDto {
  @ApiProperty({
    example: 'Voleibol',
    description: 'Nombre de la disciplina deportiva',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'voleibol',
    description: 'Ícono representativo de la disciplina (nombre de la disciplina en minúsculas sin espacios)',
  })
  @IsString()
  @IsNotEmpty()
  icon: string;
}
