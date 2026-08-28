import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class ApplyLateFeeDto {
  @ApiPropertyOptional({
    description: 'Monto de la mora personalizado (debe ser mayor a 0)',
    example: 150,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  customAmount?: number;
}
