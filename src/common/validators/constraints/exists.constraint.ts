import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrismaService } from 'src/prisma.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(private readonly prisma: PrismaService) {}

  async validate(value: any, args: ValidationArguments) {
    const [model, field = 'id'] = args.constraints;

    if (value === null || value === undefined) {
      return true;
    }

    const prismaModel = (this.prisma as any)[model];

    if (!prismaModel) {
      return false;
    }

    // ARRAY
    if (Array.isArray(value)) {
      const filteredValues = value.filter((v) => v !== null && v !== undefined);

      if (filteredValues.length === 0) {
        return true;
      }

      const records = await prismaModel.findMany({
        where: {
          [field]: {
            in: filteredValues,
          },
        },
        select: {
          [field]: true,
        },
      });

      return records.length === filteredValues.length;
    }

    // SINGLE
    const record = await prismaModel.findFirst({
      where: {
        [field]: value,
      },
    });

    return !!record;
  }

  defaultMessage(args: ValidationArguments) {
    const [model] = args.constraints;

    return `Uno o más registros no existen en ${model}`;
  }
}
