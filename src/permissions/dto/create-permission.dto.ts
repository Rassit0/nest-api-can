import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'TAKE_ATTENDANCE',
    description: 'Nombre único del permiso',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'name',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  name: string;

  @ApiProperty({
    example: 'SESSIONS',
    description: 'Módulo al que pertenece el permiso',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'module',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'module',
    }),
  })
  module: string;

  @ApiPropertyOptional({
    example: 'Permite registrar la asistencia de una sesión',
    description: 'Descripción detallada del permiso',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string | null;
}
