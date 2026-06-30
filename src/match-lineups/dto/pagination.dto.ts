import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class MatchLineupsPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['createdAt', 'goals', 'minutesPlayed', 'id'], {
    message: 'Columnas permitidas: createdAt, goals, minutesPlayed, id',
  })
  sortField?: string = 'createdAt';
}
