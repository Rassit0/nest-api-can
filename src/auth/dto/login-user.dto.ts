import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsEqualTo } from 'src/common/validators/decorators/is-equal-to.decorator';

export class LoginUserDto {
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
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'The password must have a Uppercase, lowercase letter and a number',
  })
  password: string;
}
