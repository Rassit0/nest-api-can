import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateUserDto {
  @ApiProperty({
    example: 'coach.juan@email.com',
    description: 'Correo electrónico del usuario (nombre de usuario)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'email',
    }),
  })
  @IsEmail(
    {},
    {
      message: i18nValidationMessage('validation.IS_EMAIL', {
        constraint1: 'email',
      }),
    },
  )
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña de acceso',
    minLength: 6,
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'password',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'password',
    }),
  })
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  password: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la persona asociada a este usuario',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'personId',
    }),
  })
  @Exists('person', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'personId',
    }),
  })
  personId?: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del rol asignado al usuario',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'roleId',
    }),
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'roleId',
    }),
  })
  @Exists('role', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'roleId',
    }),
  })
  roleId: string;
}
