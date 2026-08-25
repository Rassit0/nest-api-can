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
import { ProgramGender, StatusTeamSeason } from 'src/generated/prisma/enums';
import { ValidateNested } from 'class-validator';
import { SeasonBillingConfigDto } from 'src/common/dto/season-billing-config.dto';

import { CreateTeamSeasonCategoryDto } from './create-team-season-category.dto';

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
  @IsOptional()
  description: string;

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

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del equipo (Team)',
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
    type: [CreateTeamSeasonCategoryDto],
    description: 'Lista de categorías asociadas a la temporada',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateTeamSeasonCategoryDto)
  categories: CreateTeamSeasonCategoryDto[];

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

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si las inscripciones están abiertas',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isRegistrationOpen?: boolean;
}
