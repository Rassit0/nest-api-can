import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { GenderCategory } from 'src/generated/prisma/enums';

@ValidatorConstraint({ name: 'isGreaterThan', async: false })
export class IsGreaterThanConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return (
      typeof value === 'number' &&
      typeof relatedValue === 'number' &&
      value > relatedValue
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} debe ser mayor que ${args.constraints[0]}`;
  }
}

export class CreateCategoryDto {
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING'),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY'),
  })
  name: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'null' || value === '' ? null : value))
  @ValidateIf((object, value) => value !== null)
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING'),
  })
  description: string;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER'),
    },
  )
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY'),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: 0,
    }),
  })
  minAge: number;

  @IsNumber(
    {},
    {
      message: i18nValidationMessage('validation.IS_NUMBER'),
    },
  )
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY'),
  })
  @Min(0, {
    message: i18nValidationMessage('validation.MIN', {
      constraint1: 0,
    }),
  })
  @Validate(IsGreaterThanConstraint, ['minAge']) // <--- Aquí ocurre la magia
  maxAge: number;

  @IsEnum(GenderCategory, {
    message: i18nValidationMessage('validation.IS_ENUM', {
      // Pasamos los valores permitidos como un string unido por comas
      validValues: `(${Object.values(GenderCategory).join(', ')})`,
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY'),
  })
  gender: GenderCategory;

  @IsBoolean()
  @IsOptional()
  isActive: boolean;
}
