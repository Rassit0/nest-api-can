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
} from 'src/generated/prisma/enums';
import { ValidateNested } from 'class-validator';
import { SeasonBillingConfigDto } from 'src/common/dto/season-billing-config.dto';

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
    type: SeasonBillingConfigDto,
    description: 'Configuración financiera y de facturación de la temporada',
  })
  @ValidateNested()
  @Type(() => SeasonBillingConfigDto)
  @IsOptional()
  billingConfig?: SeasonBillingConfigDto;

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

}
