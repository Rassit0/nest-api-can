import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class MatchPartialDto {
  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID del parcial (enviar solo al actualizar uno existente)',
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'id',
    }),
  })
  id?: string;

  @ApiProperty({
    example: 1,
    description: 'Orden del parcial (1, 2, 3...)',
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'sequence',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'sequence',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  sequence: number;

  @ApiPropertyOptional({
    example: 'Q1',
    description: 'Etiqueta del parcial (Set 1, 1T, etc.)',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'label',
    }),
  })
  label?: string | null;

  @ApiPropertyOptional({
    example: 20,
    description: 'Marcador del equipo local en este parcial',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'homeScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'homeScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  homeScore?: number | null;

  @ApiPropertyOptional({
    example: 18,
    description: 'Marcador del equipo visitante en este parcial',
    nullable: true,
  })
  @IsOptional()
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'awayScore',
    }),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'awayScore',
      constraint2: 0,
    }),
  })
  @Type(() => Number)
  awayScore?: number | null;
}
