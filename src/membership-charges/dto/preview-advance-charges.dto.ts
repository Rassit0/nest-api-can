import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, Min } from 'class-validator';

export class PreviewAdvanceChargesDto {
  @ApiProperty({
    description: 'Cantidad de cuotas a previsualizar para su adelanto',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsPositive()
  quantity: number;
}
