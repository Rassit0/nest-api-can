import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsUUID,
  IsISO8601,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInternalTransferDto {
  @ApiProperty({
    description: 'Monto a transferir',
    example: 50.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description:
      'ID de la cuenta de origen (caja o banco que emitirá el dinero)',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  sourceAccountId: string;

  @ApiProperty({
    description:
      'ID de la cuenta de destino (caja o banco que recibirá el dinero)',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  destinationAccountId: string;

  @ApiPropertyOptional({
    description: 'Descripción o motivo de la transferencia',
    example: 'Reposición de caja chica',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Referencia bancaria o código de recibo si aplica',
  })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Fecha de la transferencia (por defecto la actual)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsISO8601()
  @IsOptional()
  date?: string;
}
