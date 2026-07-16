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
} from 'src/generated/prisma/client';
import { ValidateNested } from 'class-validator';
import { SeasonBillingConfigDto } from 'src/common/dto/season-billing-config.dto';

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
    type: SeasonBillingConfigDto,
    description: 'Configuración financiera y de facturación de la temporada',
  })
  @ValidateNested()
  @Type(() => SeasonBillingConfigDto)
  @IsOptional()
  billingConfig?: SeasonBillingConfigDto;

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
    example: true,
    description: 'Indica si las inscripciones están abiertas',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRegistrationOpen?: boolean;


}
