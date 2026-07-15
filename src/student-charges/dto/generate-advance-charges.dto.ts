import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min } from 'class-validator';

export class GenerateAdvanceChargesDto {
  @ApiProperty({
    description: 'Cantidad de cuotas a generar por adelantado',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsPositive()
  quantity: number;
}
