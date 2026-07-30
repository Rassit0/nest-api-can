import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChargeDirection } from 'src/generated/prisma/client';

export class CreateAccountCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(ChargeDirection)
  @IsNotEmpty()
  type: ChargeDirection;
}
