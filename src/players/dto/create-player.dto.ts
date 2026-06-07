import { CreatePersonDto } from 'src/persons/dto/create-person.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { i18nValidationMessage } from 'nestjs-i18n';

export class CreatePlayerDto extends CreatePersonDto {
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isActive',
    }),
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === 1 || value === true
      ? true
      : value === 'false' || value === 0 || value === false
        ? false
        : null,
  )
  isActive?: boolean;
}
