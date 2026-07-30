import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from 'src/common/dto/pagination';
import { ChargeDirection, StatusCharge } from 'src/generated/prisma/client';

export class AccountChargesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ChargeDirection)
  direction?: ChargeDirection;

  @IsOptional()
  @IsEnum(StatusCharge, { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  status?: StatusCharge[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sortField?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsString()
  externalEntity?: string;
}
