// modules/disciplines/dto/discipline-pagination.dto.ts
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { PaginationDto } from 'src/common/dto/pagination';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { Gender, PlayerPassStatus } from 'src/generated/prisma/enums';

export class GetTeamsByClubOptionsDto extends PaginationDto {
  @IsEnum(Gender)
  gender: Gender;
}
