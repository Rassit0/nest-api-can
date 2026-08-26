import { IsInt, Min, Max, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MonthlyCashflowQueryDto {
  @ApiProperty({ description: 'Año (ej: 2026)', minimum: 2000, maximum: 2100 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ description: 'Mes (ej: 8)', minimum: 1, maximum: 12 })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
