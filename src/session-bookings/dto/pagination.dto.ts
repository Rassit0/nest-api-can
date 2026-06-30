import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class SessionBookingsPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['createdAt', 'attended', 'isExternal', 'id'], {
    message: 'Columnas permitidas: createdAt, attended, isExternal, id',
  })
  sortField?: string = 'createdAt';
}
