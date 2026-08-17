import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min } from 'class-validator';

export class PurchaseAdvanceCyclesDto {
  @ApiProperty({
    description: 'Cantidad de cuotas a comprar por adelantado',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsPositive()
  quantity: number;
}
