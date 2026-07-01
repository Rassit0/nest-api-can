import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateStudentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la persona asociada a este estudiante',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'personId',
    }),
  })
  @Exists('person', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'personId',
    }),
  })
  @IsNotEmpty({
    message: i18nValidationMessage('validation.IS_NOT_EMPTY', {
      constraint1: 'personId',
    }),
  })
  personId: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado de actividad del estudiante',
    default: true,
  })
  @IsOptional()
  @IsBoolean({
    message: i18nValidationMessage('validation.IS_BOOLEAN', {
      constraint1: 'isActive',
    }),
  })
  @Type(() => Boolean)
  isActive?: boolean = true;
}
