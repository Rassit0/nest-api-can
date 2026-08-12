import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialAccountType, PaymentMethod } from 'src/generated/prisma/enums';

export class CreateFinancialAccountDto {
  @ApiProperty({
    description: 'Nombre de la cuenta financiera',
    example: 'Caja Principal',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción de la cuenta',
    example: 'Caja chica de recepción',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Tipo de cuenta',
    enum: FinancialAccountType,
    example: FinancialAccountType.CASH,
  })
  @IsEnum(FinancialAccountType)
  type: FinancialAccountType;

  @ApiPropertyOptional({
    description: 'Número de cuenta bancaria',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({
    description: 'Indica si es la cuenta por defecto',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Saldo inicial de la cuenta',
    example: 1000.5,
  })
  @IsNumber()
  @IsOptional()
  initialBalance?: number;

  @ApiProperty({
    description: 'Métodos de pago permitidos en esta cuenta',
    enum: PaymentMethod,
    isArray: true,
    example: [PaymentMethod.CASH],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(PaymentMethod, { each: true })
  allowedPaymentMethods: PaymentMethod[];
}
