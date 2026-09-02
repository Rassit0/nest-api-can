import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum, IsDateString, IsISO8601 } from 'class-validator';
import { Transform } from 'class-transformer';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { TransactionType, PaymentMethod } from 'src/generated/prisma/client';

export class TransactionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'transactionDate', 'amount', 'type', 'status', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'transactionDate', 'amount', 'type', 'status', 'id'], {
    message:
      'Columnas permitidas: createdAt, transactionDate, amount, type, status, id',
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por ID de persona que paga/recibe',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('person', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'payerPersonId',
    }),
  })
  @IsOptional()
  payerPersonId?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar transacciones aplicadas a un cargo en específico',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {}),
  })
  @Exists('charge', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'chargeId',
    }),
  })
  @IsOptional()
  chargeId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @ApiPropertyOptional({ enum: PaymentMethod, isArray: true, description: 'Filtrar por métodos de pago (acepta un string separado por comas o arreglo)' })
  @IsEnum(PaymentMethod, { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : value?.split(','))
  @IsOptional()
  paymentMethods?: PaymentMethod[];

  @ApiPropertyOptional({ type: [String], description: 'Filtrar por cuentas contables / financieras (acepta un string separado por comas o arreglo)' })
  @IsUUID('4', { each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : value?.split(','))
  @IsOptional()
  financialAccountIds?: string[];

  @ApiPropertyOptional()
  @IsISO8601({ strict: true }, { message: 'startDate must be a valid ISO 8601 string' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsISO8601({ strict: true }, { message: 'endDate must be a valid ISO 8601 string' })
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: ['ACCOUNT_CHARGE', 'MEMBERSHIP', 'STUDENT', 'BOOKING'] })
  @IsIn(['ACCOUNT_CHARGE', 'MEMBERSHIP', 'STUDENT', 'BOOKING'])
  @IsOptional()
  origin?: 'ACCOUNT_CHARGE' | 'MEMBERSHIP' | 'STUDENT' | 'BOOKING';

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  createdById?: string;
}
