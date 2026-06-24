// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class ClubsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['name', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'], {
    message: i18nValidationMessage('validation.IS_IN', {
      validValues: 'name, createdAt',
    }),
  })
  sortField?: string = 'createdAt'; // Valor por defecto para este módulo

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la disciplina',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'disciplineId',
    }),
  })
  @Exists('discipline', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'disciplineId',
    }),
  })
  @IsOptional()
  disciplineId?: string;
}
