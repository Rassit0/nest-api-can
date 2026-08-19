import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCourseSeasonDto } from './create-course-season.dto';

export class UpdateCourseSeasonDto extends PartialType(
  OmitType(CreateCourseSeasonDto, ['shiftId', 'maxMembers', 'minMembers'] as const),
) {}
