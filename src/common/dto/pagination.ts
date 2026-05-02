// common/dto/pagination.dto.ts
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';

export enum OrderBy {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  per_page?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsEnum(OrderBy)
  orderBy?: OrderBy = OrderBy.ASC;
}
