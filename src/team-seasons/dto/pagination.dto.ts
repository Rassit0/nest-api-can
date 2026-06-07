// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { SeasonStatus } from 'src/generated/prisma/enums';

export class TeamSeasonsPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['maxMembers', 'minMembers', 'createdAt', 'id'], {
    message: 'Columnas permitidas: maxMembers, minMembers, createdAt, id',
  })
  sortField?: string = 'createdAt'; // Valor por defecto para este módulo

  @IsOptional()
  @IsUUID()
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'teamId',
    }),
  })
  teamId: string;

  @IsOptional()
  @IsEnum(SeasonStatus, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status?: SeasonStatus;
}
