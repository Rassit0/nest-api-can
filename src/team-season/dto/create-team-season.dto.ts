import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';
import {
  ProgramGender,
  StatusTeamSeason,
  SeasonBillingType,
  BillingFrequency,
} from 'src/generated/prisma/enums';

export class CreateTeamSeasonDto {
  @ApiProperty({
    example: 'Temporada 2024',
    description: 'Descripción de la temporada del equipo',
    required: false,
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
  @IsOptional()
  description: string;

  @ApiProperty({
    example: 20,
    description:
      'Número máximo de miembros permitidos en esta oferta de membresía',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  @IsAfter('minMembers', {
    message: i18nValidationMessage('validation.IS_AFTER', {
      constraint1: 'minMembers',
    }),
  })
  maxMembers: number;

  @ApiProperty({
    example: 20,
    description:
      'Número máximo de miembros permitidos en esta oferta de membresía',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  minMembers: number;

  @ApiPropertyOptional({
    example: 2015,
    description: 'Año mínimo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minBirthYear',
    }),
  })
  @Min(1900, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1900',
    }),
  })
  @IsOptional()
  minBirthYear?: number;

  @ApiPropertyOptional({
    example: 2016,
    description: 'Año máximo de nacimiento permitido (sobreescribe la edad de la categoría)',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxBirthYear',
    }),
  })
  @Min(1900, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1900',
    }),
  })
  @IsOptional()
  maxBirthYear?: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'Imagen del equipo (JPEG o PNG, máximo 5MB)',
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(5e6, {
    message: i18nValidationMessage('validation.MAX_FILE_SIZE', {
      constraint1: '5MB',
    }),
  })
  @HasMimeType(['image/jpeg', 'image/png'], {
    message: i18nValidationMessage('validation.WRONG_FILE_TYPE', {
      constraint1: 'JPEG o PNG',
    }),
  })
  imageUrl?: File | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del equipo',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'teamId',
    }),
  })
  @Exists('team', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'teamId',
    }),
  })
  teamId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'categoryId',
    }),
  })
  @Exists('category', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'categoryId',
    }),
  })
  categoryId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la temporada',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'seasonId',
    }),
  })
  @Exists('season', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'seasonId',
    }),
  })
  seasonId: string;

  @ApiProperty({
    example: 'MALE',
    enum: ProgramGender,
    description: 'Género del programa',
  })
  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'gender',
    }),
  })
  gender: ProgramGender;

  @ApiProperty({
    example: '20.00',
    description: 'Costo de matrícula para esta oferta de membresía',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'registrationFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @IsOptional()
  registrationFee?: string;

  @ApiPropertyOptional({
    example: '20.00',
    description: 'Costo de la mensualidad para esta oferta de membresía',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'recurringFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @IsOptional()
  recurringFee?: string;

  @ApiProperty({
    example: 20,
    description:
      'Cantidad de meses de tolerancia de deuda para esta oferta de membresía',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'debtToleranceMonths',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '0',
    }),
  })
  @Max(12, {
    message: i18nValidationMessage('validation.MAX', {
      constraint1: '12',
    }),
  })
  debtToleranceMonths: number;

  @ApiProperty({
    example: 20,
    description: 'Día del mes en que se realiza el cobro de la membresía',
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'billingDay',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '1',
    }),
  })
  @Max(28, {
    message: i18nValidationMessage('validation.MAX', {
      constraint1: '28',
    }),
  })
  billingDay: number;

  @ApiProperty({
    example: false,
    description:
      'Indica si esta oferta de membresía tiene habilitada una cuota por pago tardío',
  })
  @Transform(({ value }) => value === 'true')
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'lateFeeEnabled',
    }),
  })
  lateFeeEnabled: boolean;

  @ApiProperty({
    example: '1.00',
    description:
      'Monto de la cuota por pago tardío para esta oferta de membresía (si lateFeeEnabled es true)',
    required: false,
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'recurringFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @IsOptional()
  lateFeePerDay?: string;

  @ApiProperty({
    example: 3,
    description:
      'Número de días de gracia para esta oferta de membresía (si lateFeeEnabled es true)',
    required: false,
  })
  @Type(() => Number)
  @IsInt({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: '0',
    }),
  })
  @IsOptional()
  graceDays?: number;

  @ApiProperty({
    example: StatusTeamSeason.DRAFT,
    enum: StatusTeamSeason,
    description: 'Estado de la temporada de equipo',
  })
  @IsEnum(StatusTeamSeason, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status: StatusTeamSeason;

  @ApiPropertyOptional({
    example: '150.00',
    description: 'Costo total de la temporada (usado en planes de pago único)',
  })
  @IsDecimal(
    {
      decimal_digits: '0,2',
      locale: 'en-US',
    },
    {
      message: i18nValidationMessage('validation.IS_STRING', {
        constraint1: 'seasonFee',
      }),
    },
  )
  @Matches(/^[^-].*$/, {
    message: 'No se permiten valores negativos',
  })
  @IsOptional()
  seasonFee?: string;

  @ApiPropertyOptional({
    example: SeasonBillingType.MONTHLY_ONLY,
    enum: SeasonBillingType,
    description:
      'Estrategia de facturación de la temporada (mensual, único, o ambos)',
    default: SeasonBillingType.MONTHLY_ONLY,
  })
  @IsEnum(SeasonBillingType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'billingType',
    }),
  })
  @IsOptional()
  billingType?: SeasonBillingType;

  @ApiPropertyOptional({
    example: BillingFrequency.MONTHLY,
    enum: BillingFrequency,
    description: 'Frecuencia de facturación',
    default: BillingFrequency.MONTHLY,
  })
  @IsEnum(BillingFrequency, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'billingFrequency',
    }),
  })
  @IsOptional()
  billingFrequency?: BillingFrequency;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorratear la primera cuota recurrente si no es mes completo',
    default: true,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateFirstRecurringFee',
    }),
  })
  @IsOptional()
  prorateFirstRecurringFee?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorratear la última cuota recurrente si no es mes completo',
    default: true,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateLastRecurringFee',
    }),
  })
  @IsOptional()
  prorateLastRecurringFee?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Prorratear el monto de inscripción basado en el tiempo restante de la temporada',
    default: false,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateRegistrationFee',
    }),
  })
  @IsOptional()
  prorateRegistrationFee?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Prorratear el monto de temporada completa (Season Fee) basado en el tiempo restante',
    default: false,
  })
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'prorateSeasonFee',
    }),
  })
  @IsOptional()
  prorateSeasonFee?: boolean;
}
