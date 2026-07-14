import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudentMembershipPauseDto {
  @ApiProperty({ example: '2023-12-01T00:00:00.000Z', description: 'Fecha de inicio de la pausa' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty({ example: '2023-12-15T00:00:00.000Z', description: 'Fecha de fin de la pausa' })
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ example: 'Vacaciones de invierno', description: 'Razón de la pausa' })
  @IsOptional()
  @IsString()
  reason?: string;
}
