import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UpdateAvatarDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo de imagen para el avatar',
  })
  @IsFile({
    message: i18nValidationMessage('validation.IS_FILE', {
      constraint1: 'image',
    }),
  })
  @MaxFileSize(20 * 1024 * 1024, { // 20MB
    message: i18nValidationMessage('validation.MAX_FILE_SIZE', {
      constraint1: '20MB',
    }),
  })
  @HasMimeType(['image/jpeg', 'image/png', 'image/webp'], {
    message: i18nValidationMessage('validation.IS_MIME_TYPE', {
      constraint1: 'JPEG, PNG, o WEBP',
    }),
  })
  file: MemoryStoredFile;
}
