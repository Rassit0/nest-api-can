import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindPublicFixtureDto {
  @ApiPropertyOptional({ description: 'Fecha de inicio del rango (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin del rango (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
