import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';
import { Exists } from 'src/common/validators/decorators/exists.decorator';

export class CreateCourseDto {
  @ApiProperty({
    example: 'Fútbol Infantil Avanzado',
    description: 'Nombre del curso escolar',
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
    example:
      'Curso destinado a niños de 8 a 10 años con bases técnicas desarrolladas',
    description: 'Descripción del curso',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'description',
    }),
  })
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://images.com/course.jpg',
    description: 'URL de la imagen del curso',
    nullable: true,
  })
  @IsOptional()
  @IsString({
    message: i18nValidationMessage('validation.IS_STRING', {
      constraint1: 'imageUrl',
    }),
  })
  imageUrl?: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID de la escuela asociada (School)',
  })
  @IsUUID('4', {
    message: i18nValidationMessage('validation.IS_UUID', {
      constraint1: 'schoolId',
    }),
  })
  @Exists('school', 'id', {
    message: i18nValidationMessage('validation.NOT_EXISTS', {
      constraint1: 'schoolId',
    }),
  })
  schoolId: string;
}
