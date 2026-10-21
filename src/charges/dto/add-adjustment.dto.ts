import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddAdjustmentDto {
  @ApiProperty({
    description: 'Monto del ajuste. Positivo = Recargo, Negativo = Descuento, Cero = Sin ajuste',
    example: 50.0,
  })
  @IsNumber()
  adjustmentAmount: number;

  @ApiPropertyOptional({
    description: 'Razón o motivo por el cual se aplica el ajuste',
    example: 'Compensación por error en facturación',
  })
  @IsOptional()
  @IsString()
  adjustmentReason?: string;

  @ApiPropertyOptional({
    description: 'Indica si el ajuste es un descuento total autorizado (o beca) que mantiene y confirma la inscripción del ciclo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isScholarship?: boolean;
}

