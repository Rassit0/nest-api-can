import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCashClosureDto {
  @ApiProperty({
    description: 'ID de la cuenta financiera (debe ser de tipo CASH)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'El ID de la cuenta es obligatorio' })
  financialAccountId: string;

  @ApiProperty({
    description: 'Monto físico real contado por el usuario',
    example: 950.5,
  })
  @IsNumber()
  @Min(0, { message: 'El monto contado no puede ser negativo' })
  @IsNotEmpty({ message: 'El saldo contado es obligatorio' })
  actualBalance: number;

  @ApiPropertyOptional({
    description: 'Observaciones sobre el cierre, obligatorias si hay diferencia',
    example: 'Faltan 5 Bs porque no tenía cambio para un billete de 100',
  })
  @IsString()
  @IsOptional()
  observations?: string;
}
