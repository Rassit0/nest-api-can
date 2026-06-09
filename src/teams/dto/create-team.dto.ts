import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { ProgramGender } from 'src/generated/prisma/enums';

export class CreateTeamDto {
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsDefined({ message: i18nValidationMessage('validation.IS_DEFINED') })
  @MinLength(1, {
    message: i18nValidationMessage('validation.MIN_LENGTH', { constraint1: 1 }),
  })
  name: string;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  maxAge: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER', {
        constraint1: 'maxMembers',
      }),
    },
  )
  minAge: number;

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

  @IsUUID()
  @Exists('club', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'clubId',
    }),
  })
  clubId: string;

  @IsEnum(ProgramGender, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      constraint1: 'ProgramGender',
    }),
  })
  gender: ProgramGender;
}
