// modules/disciplines/dto/discipline-pagination.dto.ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { ActivityType } from 'src/generated/prisma/enums';

export class ActivitiesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo

  @IsOptional()
  @IsIn(Object.values(ActivityType), {
    message: i18nValidationMessage('validation.IS_ENUM', {
      args: {
        validValues: Object.values(ActivityType).join(', '),
      },
    }),
  })
  type: ActivityType;

  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      args: {
        validValues: 'organizationId',
      },
    }),
  })
  organizationId?: number;

  @IsOptional()
  @IsUUID()
  teamOfferingId?: string;
}

export class DisciplinesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo
}

export class CategoriesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo
}
