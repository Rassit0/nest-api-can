// src/common/validators/decorators/at-least-one-property.decorator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function AtLeastOneProperty(
  properties: string[],
  validationOptions?: ValidationOptions,
) {
  return function (target: Function) {
    registerDecorator({
      name: 'atLeastOneProperty',
      target: target,
      propertyName: '',
      constraints: [properties],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          const obj = args.object as any;

          // Retorna true si al menos una de las propiedades tiene un valor válido
          return props.some(
            (prop) =>
              obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== '',
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [props] = args.constraints as [string[]];
          return `Debe especificar obligatoriamente al menos uno de los siguientes campos: [${props.join(', ')}].`;
        },
      },
    });
  };
}
