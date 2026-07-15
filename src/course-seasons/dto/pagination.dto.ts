import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination';
import { ProgramGender } from 'src/generated/prisma/client';

export class CourseSeasonsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Campo por el cual ordenar los resultados',
    default: 'createdAt',
    enum: ['createdAt', 'status', 'gender', 'id'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'status', 'gender', 'id'], {
    message: 'Columnas permitidas: createdAt, status, gender, id',
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Filtrar por género del programa',
    enum: ProgramGender,
  })
  @IsOptional()
  @IsEnum(ProgramGender)
  gender?: ProgramGender;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de curso',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  courseId?: string;
}
