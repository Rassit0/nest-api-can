import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsEqualTo<T extends object>(
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return (object: T, propertyName: string) => {
    registerDecorator({
      name: 'IsEqualTo',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints as [keyof T];
          const relatedValue = (args.object as T)[relatedPropertyName];

          return value === relatedValue;
        },
      },
    });
  };
}
