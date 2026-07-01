import { PartialType } from '@nestjs/swagger';
import { CreateCourseSeasonStaffDto } from './create-course-season-staff.dto';

export class UpdateCourseSeasonStaffDto extends PartialType(
  CreateCourseSeasonStaffDto,
) {}
