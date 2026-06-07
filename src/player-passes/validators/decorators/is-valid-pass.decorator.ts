import { registerDecorator, ValidationOptions } from 'class-validator';
import { PassOriginConstraint } from '../constraints/pass-origin.constraint';

export function IsValidPassOrigin(validationOptions?: ValidationOptions) {
  return function (constructor: Function) {
    registerDecorator({
      name: 'IsValidPassOrigin',
      target: constructor,
      propertyName: undefined!,
      options: validationOptions,
      validator: PassOriginConstraint,
    });
  };
}
