import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';
import { IsAfter } from 'src/common/validators/decorators/is-after.decorator';

export class AddShiftDto {
  @ApiProperty({
    description: 'El ID del nuevo turno a agregar',
    example: 'uuid',
  })
  @IsNotEmpty({ message: 'El ID del turno es requerido' })
  @IsUUID('4', { message: 'El ID del turno debe ser un UUID válido' })
  @Exists('shift', 'id', { message: 'El turno proporcionado no existe' })
  shiftId: string;

  @ApiProperty({
    example: 30,
    description: 'Número máximo de estudiantes permitidos',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'maxMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'maxMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'maxMembers',
      constraint2: 1,
    }),
  })
  @IsAfter('minMembers', {
    message: i18nValidationMessage('validation.IS_AFTER', {
      constraint1: 'minMembers',
    }),
  })
  @Type(() => Number)
  maxMembers: number;

  @ApiProperty({
    example: 5,
    description: 'Número mínimo de estudiantes necesarios',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'minMembers',
    }),
  })
  @IsInt({
    message: i18nValidationMessage('validation.IS_INT', {
      constraint1: 'minMembers',
    }),
  })
  @Min(1, {
    message: i18nValidationMessage('validation.MIN_VALUE', {
      constraint1: 'minMembers',
      constraint2: 1,
    }),
  })
  @Type(() => Number)
  minMembers: number;
}
