import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import {
  ProgramGender,
  StatusCourseSeason,
  SeasonBillingType,
  BillingFrequency,
} from 'src/generated/prisma/client';

export class CreateCourseSeasonDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del curso base (Course)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'courseId',
    }),
  })
  @Exists('course', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'courseId',
    }),
  })
  courseId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la categoría (Category)',
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
    description: 'ID de la temporada (Season)',
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

  @ApiPropertyOptional({
    example: 'Curso escolar nocturno',
    description: 'Descripción opcional para el periodo de este curso',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://images.com/courseseason.jpg',
    description: 'URL de imagen opcional para el periodo del curso',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'imageUrl',
    }),
  })
  imageUrl?: string | null;

  @ApiProperty({
    example: 30,
    description: 'Número máximo de estudiantes permitidos',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'maxMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'maxMembers',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  maxMembers: number;

  @ApiProperty({
    example: 5,
    description: 'Número mínimo de estudiantes necesarios',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'minMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minMembers',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
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
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minBirthYear',
      constraint2: 1900,
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
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'maxBirthYear',
      constraint2: 1900,
    }),
  })
  @IsOptional()
  maxBirthYear?: number;

  @ApiProperty({
    enum: ProgramGender,
    example: ProgramGender.MIXED,
    description: 'Género del programa del curso (MALE, FEMALE, MIXED)',
  })
  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'gender',
    }),
  })
  gender: ProgramGender;

  @ApiProperty({
    example: 5,
    description: 'Día de facturación comercial (del 1 al 28 de cada mes)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'billingDay',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'billingDay',
    }),
  })
  @Min(1, {
    message: 'El día de facturación debe ser al menos 1',
  })
  @Max(28, {
    message: 'El día de facturación máximo permitido es 28',
  })
  @Type(() => Number)
  billingDay: number;

  @ApiProperty({
    example: 100.0,
    description: 'Costo único de inscripción o matrícula',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'registrationFee',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'registrationFee',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'registrationFee',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  registrationFee: number;

  @ApiProperty({
    example: 80.0,
    description: 'Mensualidad regular del curso',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'recurringFee',
    }),
  })
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'recurringFee',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'recurringFee',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  recurringFee: number;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Meses de tolerancia para suspensión por deuda de mensualidades',
    default: 2,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'debtToleranceMonths',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'debtToleranceMonths',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  debtToleranceMonths?: number = 2;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si se aplican recargos por mora en pagos atrasados',
    default: false,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'lateFeeEnabled',
    }),
  })
  @Type(() => Boolean)
  lateFeeEnabled?: boolean = false;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Recargo de mora acumulativo cobrado por día de retraso',
    default: 0.0,
  })
  @IsOptional()
  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'lateFeePerDay',
      }),
    },
  )
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'lateFeePerDay',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  lateFeePerDay?: number = 0.0;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Días de tolerancia para pagar después del vencimiento sin generar mora',
    default: 0,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'graceDays',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'graceDays',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  graceDays?: number = 0;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Días antes del vencimiento comercial en los que se genera el cargo',
    default: 7,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'chargeGenerationDaysBefore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'chargeGenerationDaysBefore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  chargeGenerationDaysBefore?: number = 7;

  @ApiPropertyOptional({
    enum: StatusCourseSeason,
    example: StatusCourseSeason.DRAFT,
    description:
      'Estado del curso en la temporada (DRAFT, ACTIVE, FINISHED, CANCELLED)',
    default: StatusCourseSeason.DRAFT,
  })
  @IsOptional()
  @IsEnum(StatusCourseSeason, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'status',
    }),
  })
  status?: StatusCourseSeason = StatusCourseSeason.DRAFT;

  @ApiPropertyOptional({
    example: SeasonBillingType.MONTHLY_ONLY,
    enum: SeasonBillingType,
    description: 'Tipo de facturación (mensual, única o ambas)',
    default: SeasonBillingType.MONTHLY_ONLY,
  })
  @IsEnum(SeasonBillingType, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'billingType',
    }),
  })
  @IsOptional()
  billingType?: SeasonBillingType = SeasonBillingType.MONTHLY_ONLY;

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
  billingFrequency?: BillingFrequency = BillingFrequency.MONTHLY;

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
