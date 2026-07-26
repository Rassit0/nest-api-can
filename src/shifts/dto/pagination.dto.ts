import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class ShiftsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['createdAt', 'id', 'name'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'id', 'name'], {
    message: i18nValidationMessage('validation.IS_IN', {
      validValues: 'createdAt, id, name',
    }),
  })
  sortField?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Filtrar por institución',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'institutionId',
    }),
  })
  @Exists('institution', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'institutionId',
    }),
  })
  @IsOptional()
  institutionId?: string;
}
