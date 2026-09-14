import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export class UpdateDueDateDto {
  @ApiProperty({
    example: '2026-07-05T00:00:00.000Z',
    description: 'Nueva fecha de vencimiento del cargo (UTC)',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'dueDate',
    }),
  })
  @IsISO8601(
    { strict: true },
    {
      message: i18nValidationMessage('validation.IS_ISO8601', {
        constraint1: 'dueDate',
      }),
    },
  )
  dueDate: string;
}
