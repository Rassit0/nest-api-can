// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { ProgramGender } from 'src/generated/prisma/enums';

export class TeamsPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'name',
    enum: ['name', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo

  @ApiPropertyOptional({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por club',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'clubId',
    }),
  })
  @Exists('club', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'clubId',
    }),
  })
  @IsOptional()
  clubId?: string;
}
