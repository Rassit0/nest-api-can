import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class CourseSeasonStaffPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'startedAt',
    enum: ['startedAt', 'role', 'id'],
  })
  @IsOptional()
  @IsIn(['startedAt', 'role', 'id'], {
    message: 'Columnas permitidas: startedAt, role, id',
  })
  sortField?: string = 'startedAt';
}
