import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { Gender } from '../../generated/prisma/enums';

export class StudentsOptionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: Gender,
    description: 'Filtrar por género',
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
