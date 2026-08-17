import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChargeDirection } from 'src/generated/prisma/client';

export class CreateAccountCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  receiptSeries?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsEnum(ChargeDirection)
  @IsNotEmpty()
  type: ChargeDirection;
}
