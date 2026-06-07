import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import { SeasonStatus } from 'src/generated/prisma/enums';

export class CreateTeamSeasonsDto {
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'name',
    }),
  })
  name: string;

  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startDate: string;

  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  // Validacion para que la fecha final sea mayor a la inicial
  @IsAfter('startDate', {
    message: i18nValidationMessage('validation.IS_AFTER_START_DATE'),
  })
  endDate: string;

  @IsUUID()
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'teamId',
    }),
  })
  teamId: string;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  maxMembers: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  minMembers: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  maxYear: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  minYear: number;

  @IsDecimal(
    {},
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'monthlyFee',
      }),
    },
  )
  monthlyFee: string;

  @IsDecimal(
    {},
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'registrationFee',
      }),
    },
  )
  registrationFee: string;

  @IsDecimal(
    {},
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'fullPaymentDiscountPercent',
      }),
    },
  )
  fullPaymentDiscountPercent: string;

  @IsBoolean()
  lateFeeEnabled: boolean;

  @IsDecimal(
    {},
    {
      message: i18nValidationMessage('validation.IS_DECIMAL', {
        constraint1: 'lateFeePerDay',
      }),
    },
  )
  lateFeePerDay: string;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'graceDays',
      }),
    },
  )
  graceDays: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'suspensionAfterMonthsDue',
      }),
    },
  )
  suspensionAfterMonthsDue: number;

  @IsEnum(SeasonStatus, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status: SeasonStatus;

  @ValidateIf(
    (o) =>
      o.status === SeasonStatus.CANCELLED || o.status === SeasonStatus.FINISHED,
  )
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'statusNotes',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'statusNotes',
    }),
  })
  statusNotes?: string;
}
