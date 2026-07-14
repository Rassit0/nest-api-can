import { ApiProperty } from '@nestjs/swagger';
import {
  IsDecimal,
  IsEnum,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import { MembershipDiscountType } from 'src/generated/prisma/enums';

export class CreateMembershipDiscountDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la membresía del jugador',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'playerMembershipId',
    }),
  })
  @Exists('playerMembershipToTeam', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'playerMembershipId',
    }),
  })
  playerMembershipId: string;

  @ApiProperty({
    example: '20.00',
    description: 'Porcentaje de descuento mensual',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'recurringDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  recurringDiscountPercent: string;

  @ApiProperty({
    example: '20.00',
    description: 'Porcentaje de descuento a la matrícula',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'registrationDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  registrationDiscountPercent: string;

  @ApiProperty({
    example: '20.00',
    description: 'Porcentaje de descuento al pago de temporada completa',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'seasonFeeDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  seasonFeeDiscountPercent: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de inicio de la temporada (formato ISO 8601)',
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  startDate: string;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Fecha de fin de la temporada (formato ISO 8601)',
    required: false,
  })
  @IsISO8601(
    { strict: true },
    { message: 'El formato debe ser ISO 8601 (2026-04-28T00:00:00.000Z)' },
  )
  endDate?: string;

  @ApiProperty({
    example: MembershipDiscountType.SCHOLARSHIP,
    enum: MembershipDiscountType,
    description: 'Tipo de descuento',
  })
  @IsEnum(MembershipDiscountType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'type',
    }),
  })
  type: MembershipDiscountType;

  @ApiProperty({
    example: 'U-13',
    description: 'Razón de la membresía, obligatorío si el tipo es Otro',
  })
  @ValidateIf((o) => o.type === MembershipDiscountType.OTHER)
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'reason',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'reason',
      constraint2: 3,
    }),
  })
  reason?: string;
}
