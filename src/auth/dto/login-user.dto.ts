import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Transform } from 'class-transformer';

export class LoginUserDto {
  @ApiProperty({
    example: 'admin@can.edu.bo',
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
  @MaxLength(255, {
    message: i18nValidationMessage('validation.MAX_LENGTH', {
      constraint1: 'email',
      constraint2: 255,
    }),
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email: string;

  @ApiProperty({
    example: 'admin123',
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
  @MaxLength(100, {
    message: i18nValidationMessage('validation.MAX_LENGTH', {
      constraint1: 'password',
      constraint2: 100,
    }),
  })
  password: string;
}
