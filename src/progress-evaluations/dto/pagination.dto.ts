import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class ProgressEvaluationsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'evaluationDate',
    enum: ['evaluationDate', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['evaluationDate', 'createdAt', 'id'], {
    message: 'Columnas permitidas: evaluationDate, createdAt, id',
  })
  sortField?: string = 'evaluationDate';
}
