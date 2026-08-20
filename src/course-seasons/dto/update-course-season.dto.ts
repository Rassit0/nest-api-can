import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCourseSeasonDto } from './create-course-season.dto';

export class UpdateCourseSeasonDto extends PartialType(
  OmitType(CreateCourseSeasonDto, [
    'shiftId',
    'maxMembers',
    'minMembers',
    'categoryId',
    'gender',
    'minBirthYear',
    'maxBirthYear',
    'validateAge',
  ] as const),
) {}
