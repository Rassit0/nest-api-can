import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DashboardFilterDto {
  @ApiPropertyOptional({
    description: 'Fecha de inicio del periodo en formato ISO 8601 (UTC)',
    example: '2026-08-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'start debe ser una fecha ISO 8601 válida' })
  start?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del periodo en formato ISO 8601 (UTC)',
    example: '2026-08-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'end debe ser una fecha ISO 8601 válida' })
  end?: string;
}
