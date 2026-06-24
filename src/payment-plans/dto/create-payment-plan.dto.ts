import { ApiProperty } from '@nestjs/swagger';
import {
  IsDecimal,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';

export class CreatePaymentPlanDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'ID de la oferta de membresía a la que pertenece este plan de pago',
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

  @ApiProperty({
    example:
      'Plan de pago con descuento del 20% a la mensualidad y matrícula para la oferta de membresía X',
    description: 'Nombre del plan de pago',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  name: string;

  @ApiProperty({
    example: '20.00',
    description:
      'Porcentaje de descuento de matrícula aplicado a este plan de pago',
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
    description: 'Porcentaje de descuento mensual aplicado a este plan de pago',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'monthlyDiscountPercent',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @Matches(/^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/, {
    message: 'El porcentaje debe estar entre 0 y 100',
  })
  monthlyDiscountPercent: string;
}
