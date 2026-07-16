import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateSchoolDto {
  @ApiProperty({
    example: 'Escuela de Fútbol Base',
    description: 'Nombre de la escuela',
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'name',
    }),
  })
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'name',
    }),
  })
  name: string;

  @ApiPropertyOptional({
    example: 'CAN',
    description: 'Nombre abreviado del club',
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
    description: 'ID de la disciplina (Discipline)',
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
