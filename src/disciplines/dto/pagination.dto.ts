// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class DisciplinePaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['name', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo
}
