import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class AddDiscountDto {
  @ApiProperty({
    description: 'Monto del descuento a aplicar al cargo',
    example: 50.0,
  })
  @IsNumber()
  @IsPositive()
  discountAmount: number;

  @ApiPropertyOptional({
    description: 'Razón o motivo por el cual se aplica el descuento',
    example: 'Compensación por error en facturación',
  })
  @IsOptional()
  @IsString()
  discountReason?: string;
}
