import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class UsersPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'email',
    enum: ['email', 'createdAt', 'isActive', 'id'],
  })
  @IsOptional()
  @IsIn(['email', 'createdAt', 'isActive', 'id'], {
    message: 'Columnas permitidas: email, createdAt, isActive, id',
  })
  sortField?: string = 'email';
}
