import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class SessionsPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['dateTime', 'title', 'createdAt', 'id'], {
    message: 'Columnas permitidas: dateTime, title, createdAt, id',
  })
  sortField?: string = 'dateTime';
}
