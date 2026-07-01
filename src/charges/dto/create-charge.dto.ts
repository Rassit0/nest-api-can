import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { StatusCharge } from 'src/generated/prisma/client';

export class CreateChargeDto {
  @ApiPropertyOptional({
    example: 'Cargo de matrícula',
    description: 'Descripción del cargo facturado',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string | null;

  @ApiProperty({
    example: 150.0,
    description: 'Monto total del cargo',
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

  @ApiPropertyOptional({
    example: 150.0,
    description: 'Monto pendiente de pago del cargo',
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'pendingAmount',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'pendingAmount',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  pendingAmount?: number;

  @ApiProperty({
    example: '2026-07-05T00:00:00.000Z',
    description: 'Fecha de vencimiento del cargo',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'dueDate',
    }),
  })
  @IsDate({
    message: i18nValidationMessage('validation.IS_DATE', {
      constraint1: 'dueDate',
    }),
  })
  @Type(() => Date)
  dueDate: Date;

  @ApiPropertyOptional({
    enum: StatusCharge,
    example: StatusCharge.PENDING,
    description: 'Estado de pago (PENDING, PARTIAL, PAID, CANCELLED)',
    default: StatusCharge.PENDING,
  })
  @IsOptional()
  @IsEnum(StatusCharge, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status?: StatusCharge = StatusCharge.PENDING;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del cargo padre (si este cargo es un recargo por mora)',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'parentChargeId',
    }),
  })
  @Exists('charge', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'parentChargeId',
    }),
  })
  parentChargeId?: string | null;
}
