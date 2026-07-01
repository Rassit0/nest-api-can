import { PartialType } from '@nestjs/swagger';
import { CreateStudentDiscountDto } from './create-student-discount.dto';

export class UpdateStudentDiscountDto extends PartialType(
  CreateStudentDiscountDto,
) {}
