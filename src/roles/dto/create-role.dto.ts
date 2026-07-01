import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreateRoleDto {
  @ApiProperty({
    example: 'COACH',
    description: 'Nombre único del rol (ej: ADMIN, COACH, PARENT, PLAYER)',
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

  @ApiPropertyOptional({
    example: 'Rol destinado a entrenadores y profesores',
    description: 'Descripción del rol',
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
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Arreglo de IDs de permisos asociados a este rol',
  })
  @IsOptional()
  @IsArray({
    message: 'permissionIds debe ser un arreglo de IDs',
  })
  @IsUUID('4', {
    each: true,
    message: 'Cada ID de permiso debe ser un UUID válido',
  })
  permissionIds?: string[];
}
