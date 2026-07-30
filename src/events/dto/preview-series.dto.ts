import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class PreviewSeriesDto {
  @ApiProperty({
    example: '2026-06-30T18:00:00.000Z',
    description: 'Fecha de inicio del primer evento',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    example: '2026-06-30T19:00:00.000Z',
    description: 'Fecha de fin del primer evento',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la ubicación',
  })
  @IsOptional()
  @IsUUID('4')
  locationId?: string;

  @ApiProperty({
    example: 'FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=1',
    description: 'Regla de recurrencia en formato RRULE',
  })
  @IsNotEmpty()
  @IsString()
  recurrenceRule: string;

  @ApiPropertyOptional({
    example: 'America/La_Paz',
    description: 'Zona horaria',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
