import { PartialType } from '@nestjs/swagger';
import { CreateStudentChargeDto } from './create-student-charge.dto';

export class UpdateStudentChargeDto extends PartialType(
  CreateStudentChargeDto,
) {}
