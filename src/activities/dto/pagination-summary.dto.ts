import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class ActivitiesSummaryPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        args: {
          validValues: 'organizationId',
        },
      }),
    },
  )
  @Exists('organization', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'organizationId',
    }),
  })
  organizationId?: number;

  @IsOptional()
  @IsUUID()
  @Exists('teamSeason', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'teamSeasonId',
    }),
  })
  teamSeasonId?: string;
}
