import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateClubDto {
  @ApiProperty({
    example: 'Club Deportivo XYZ',
    description: 'Nombre del club',
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  @MinLength(3, {
    message: i18nValidationMessage('validation.MIN_LENGTH', {
      constraint1: 'name',
      constraint2: 3,
    }),
  })
  name: string;

  @ApiProperty({
    example: 'CAN',
    description: 'Nombre abreviado del club',
    required: false,
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'shortName',
    }),
  })
  @IsOptional()
  shortName?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la disciplina',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'disciplineId',
    }),
  })
  @Exists('discipline', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'disciplineId',
    }),
  })
  disciplineId: string;
}
