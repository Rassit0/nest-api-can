import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class SchoolsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'name',
    enum: ['name', 'createdAt', 'id'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name';

  @ApiPropertyOptional({
    description: 'ID de la disciplina para filtrar',
  })
  @IsOptional()
  @IsUUID('4')
  disciplineId?: string;
}
