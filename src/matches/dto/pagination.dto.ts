import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';

export class MatchesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['matchDate', 'startDate', 'opponentName', 'result', 'createdAt', 'id'], {
    message:
      'Columnas permitidas: matchDate, startDate, opponentName, result, createdAt, id',
  })
  sortField?: string = 'matchDate';
}
