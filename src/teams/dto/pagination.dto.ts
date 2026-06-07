// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { ProgramGender } from 'src/generated/prisma/enums';

export class TeamsPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['name', 'createdAt', 'id'], {
    message: 'Columnas permitidas: name, createdAt, id',
  })
  sortField?: string = 'name'; // Valor por defecto para este módulo

  @IsOptional()
  @IsUUID('all', {
    message: i18nValidationMessage('validation.UUID', {
      constraint1: 'clubId',
    }),
  })
  @Exists('club', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'clubId',
    }),
  })
  clubId?: string;

  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'ProgramGender',
    }),
  })
  @IsOptional()
  gender?: ProgramGender;
}
