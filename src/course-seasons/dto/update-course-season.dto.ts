import { PartialType } from '@nestjs/swagger';
import { CreateCourseSeasonDto } from './create-course-season.dto';

export class UpdateCourseSeasonDto extends PartialType(CreateCourseSeasonDto) {}
