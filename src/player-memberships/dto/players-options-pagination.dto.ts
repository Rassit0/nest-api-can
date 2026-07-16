import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { Gender } from '../../generated/prisma/enums';

export class PlayersOptionsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: Gender,
    description: 'Filtrar por género',
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
