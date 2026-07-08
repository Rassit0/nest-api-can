import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { PaymentMethod, TransactionType } from 'src/generated/prisma/client';

export class CreateChargeTransactionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del cargo a pagar',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'chargeId',
    }),
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'chargeId',
    }),
  })
  @Exists('charge', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'chargeId',
    }),
  })
  chargeId: string;

  @ApiProperty({
    example: 50.0,
    description: 'Monto a aplicar a este cargo',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'amountApplied',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'amountApplied',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'amountApplied',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  amountApplied: number;
}

export class CreateTransactionDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la persona que realiza/recibe el pago',
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'payerPersonId',
    }),
  })
  @Exists('person', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'payerPersonId',
    }),
  })
  payerPersonId?: string;

  @ApiProperty({
    example: 150.0,
    description: 'Monto total de la transacción',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'amount',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'amount',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'amount',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    example: '2026-07-05T00:00:00.000Z',
    description: 'Fecha en que se realiza la transacción',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'transactionDate',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'transactionDate',
    }),
  })
  @Type(() => Date)
  transactionDate: Date;

  @ApiPropertyOptional({
    example: 'Pago de mensualidad julio',
    description: 'Descripción breve de la transacción',
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string;

  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.INCOME,
    description: 'Tipo de transacción (INCOME, EXPENSE)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'type',
    }),
  })
  @IsEnum(TransactionType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'type',
    }),
  })
  type: TransactionType;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
    description: 'Método de pago (QR, TRANSFER, CASH)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'paymentMethod',
    }),
  })
  @IsEnum(PaymentMethod, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'paymentMethod',
    }),
  })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    example: '123456789',
    description: 'Número de referencia bancaria o comprobante',
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'reference',
    }),
  })
  reference?: string;

  @ApiPropertyOptional({
    example: 'El apoderado pagó en efectivo en caja',
    description: 'Notas adicionales internas',
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'notes',
    }),
  })
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateChargeTransactionDto],
    description: 'Lista de cargos a los que se aplica este pago',
  })
  @IsOptional()
  @IsArray({
    message: i18nValidationMessage('validation.IS_ARRAY', {
      constraint1: 'chargeTransactions',
    }),
  })
  @ValidateNested({ each: true })
  @Type(() => CreateChargeTransactionDto)
  chargeTransactions?: CreateChargeTransactionDto[];
}
