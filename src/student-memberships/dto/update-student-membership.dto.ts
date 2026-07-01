import { PartialType } from '@nestjs/swagger';
import { CreateStudentMembershipDto } from './create-student-membership.dto';

export class UpdateStudentMembershipDto extends PartialType(
  CreateStudentMembershipDto,
) {}
