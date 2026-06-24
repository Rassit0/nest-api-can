import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsAfter(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          // Permite que otros decoradores manejen required/optional
          if (
            value === undefined ||
            value === null ||
            relatedValue === undefined ||
            relatedValue === null
          ) {
            return true;
          }

          // Comparación numérica
          const currentNumber = Number(value);
          const relatedNumber = Number(relatedValue);

          if (
            !Number.isNaN(currentNumber) &&
            !Number.isNaN(relatedNumber)
          ) {
            return currentNumber > relatedNumber;
          }

          // Comparación de fechas
          const currentDate = new Date(value as string | Date);
          const relatedDate = new Date(relatedValue as string | Date);

          if (
            !Number.isNaN(currentDate.getTime()) &&
            !Number.isNaN(relatedDate.getTime())
          ) {
            return currentDate.getTime() > relatedDate.getTime();
          }

          return false;
        },

        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} debe ser mayor que ${relatedPropertyName}`;
        },
      },
    });
  };
}