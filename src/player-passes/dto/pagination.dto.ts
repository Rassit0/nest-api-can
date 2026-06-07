// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { PlayerPassStatus } from 'src/generated/prisma/enums';

export class PlayerPassesPaginationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['createdAt', 'id'], {
    message: 'Columnas permitidas: createdAt, id',
  })
  sortField?: string = 'createdAt'; // Valor por defecto para este módulo

  @IsIn([PlayerPassStatus.ACTIVE, PlayerPassStatus.INACTIVE, 'all'], {
    message: 'Estados permitidos: ACTIVE, INACTIVE, all',
  })
  status: PlayerPassStatus | 'all' = 'all';

  @IsUUID()
  @Exists('player', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'playerId',
    }),
  })
  @IsOptional()
  playerId: string;
}
