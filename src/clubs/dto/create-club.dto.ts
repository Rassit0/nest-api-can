import { IsString, IsUUID, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateClubDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsUUID()
  @Exists('discipline', 'id', {
    message: i18nValidationMessage('validation.EXISTS', {
      constraint1: 'disciplineId',
    }),
  })
  disciplineId: string;
}
