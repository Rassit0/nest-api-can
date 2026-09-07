import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountReferenceType, ChargeDirection, PaymentMethod } from 'src/generated/prisma/client';
import { ValidateNested, ValidateIf } from 'class-validator';
import { SplitTransactionDto } from 'src/transactions/dto/create-transaction.dto';

export class ImmediatePaymentDto {
  @ValidateIf((o) => !o.splitTransactions || o.splitTransactions.length === 0)
  @IsEnum(PaymentMethod)
  @IsNotEmpty({ message: 'El método de pago es obligatorio si no hay splitTransactions' })
  paymentMethod?: PaymentMethod;

  @ValidateIf((o) => !o.splitTransactions || o.splitTransactions.length === 0)
  @IsString()
  @IsNotEmpty({ message: 'La cuenta financiera es obligatoria si no hay splitTransactions' })
  financialAccountId?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SplitTransactionDto)
  splitTransactions?: SplitTransactionDto[];

  @IsOptional()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID('4')
  payerPersonId?: string;

  @IsOptional()
  @Type(() => Date)
  transactionDate?: Date;
}

export class CreateAccountChargeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @Type(() => Date)
  @IsNotEmpty()
  dueDate: Date;

  @IsEnum(ChargeDirection)
  @IsNotEmpty()
  direction: ChargeDirection;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsEnum(AccountReferenceType)
  @IsOptional()
  referenceType?: AccountReferenceType;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsUUID()
  @IsOptional()
  personId?: string;

  @IsString()
  @IsOptional()
  externalEntity?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImmediatePaymentDto)
  immediatePayment?: ImmediatePaymentDto;
}
