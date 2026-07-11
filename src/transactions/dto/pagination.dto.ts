import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class TransactionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'transactionDate', 'amount', 'type', 'status', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'transactionDate', 'amount', 'type', 'status', 'id'], {
    message: 'Columnas permitidas: createdAt, transactionDate, amount, type, status, id',
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
}
