import { registerDecorator, ValidationOptions } from 'class-validator';
import { ExistsConstraint } from '../constraints/exists.constraint';

export function Exists(
  model: string,
  field: string = 'id',
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'Exists',
      target: object.constructor,
      propertyName,
      constraints: [model, field],
      options: validationOptions,
      validator: ExistsConstraint,
    });
  };
}
