import { IsNotEmpty, IsString } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class FinalizeSeasonDto {
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'statusNotes',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'statusNotes',
    }),
  })
  statusNotes: string;
}
