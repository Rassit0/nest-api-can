import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class SchedulesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['dayOfWeek', 'startTime', 'createdAt', 'id'], {
    message: 'Columnas permitidas: dayOfWeek, startTime, createdAt, id',
  })
  sortField?: string = 'dayOfWeek';
}
