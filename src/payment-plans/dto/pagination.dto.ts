// modules/disciplines/dto/discipline-pagination.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class PaymentPlansPaginationDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'createdAt',
    enum: ['name', 'createdAt'],
  })
  @IsOptional()
  @IsIn(['name', 'createdAt'], {
    message: 'Columnas permitidas: name, createdAt',
  })
  sortField?: string = 'createdAt'; // Valor por defecto para este módulo

  @ApiProperty({
    // example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por temporada',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamSeasonId',
    }),
  })
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  teamSeasonId: string;
}
