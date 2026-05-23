// src/common/validators/decorators/is-mutually-exclusive.decorator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsMutuallyExclusive(
  relatedProperties: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isMutuallyExclusive',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [relatedProperties],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [properties] = args.constraints as [string[]];

          // Si el campo actual no tiene valor, no hay conflicto en este decorador
          if (value === undefined || value === null) {
            return true;
          }

          // Verificamos si alguno de los otros campos exclusivos sí tiene un valor asignado
          for (const relatedProp of properties) {
            const relatedValue = (args.object as any)[relatedProp];
            if (relatedValue !== undefined && relatedValue !== null) {
              return false; // Conflicto detectado: Ambos tienen valor
            }
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const [properties] = args.constraints as [string[]];
          const conflictFields = properties.join(', ');
          return `No se puede enviar '${args.property}' si ya se especificó uno de los siguientes campos: [${conflictFields}]. Elige solo uno.`;
        },
      },
    });
  };
}
