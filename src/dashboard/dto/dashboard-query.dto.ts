import { IsOptional, IsISO8601, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Fecha inicial del período en formato ISO 8601 (ej. 2026-10-01T00:00:00.000Z)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'from debe ser una fecha válida en formato ISO 8601' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del período en formato ISO 8601 (ej. 2026-10-31T23:59:59.999Z)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'to debe ser una fecha válida en formato ISO 8601' })
  to?: string;
}

export class DashboardActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Cantidad máxima de registros de actividad a retornar (default 10, max 50)',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit mínimo es 1' })
  @Max(50, { message: 'limit máximo es 50' })
  limit?: number = 10;
}
