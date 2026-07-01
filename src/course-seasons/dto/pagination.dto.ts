import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class CourseSeasonsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'status', 'gender', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'status', 'gender', 'id'], {
    message: 'Columnas permitidas: createdAt, status, gender, id',
  })
  sortField?: string = 'createdAt';
}
