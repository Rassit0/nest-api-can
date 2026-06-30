import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';

export enum OrderBy {
  ASC = 'asc',
  DESC = 'desc',
}

export class PaginationDto {
  @ApiPropertyOptional({
    // example: 'texto de búsqueda',
    description: 'Texto para búsqueda',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    // example: 10,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  per_page?: number = 10;

  @ApiPropertyOptional({
    // example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    enum: OrderBy,
    example: OrderBy.ASC,
  })
  @IsOptional()
  @IsEnum(OrderBy)
  orderBy?: OrderBy = OrderBy.ASC;
}
