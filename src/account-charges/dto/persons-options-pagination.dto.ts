import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { Gender } from 'src/generated/prisma/client';

export class PersonsOptionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: Gender,
    description: 'Filtrar por género',
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
