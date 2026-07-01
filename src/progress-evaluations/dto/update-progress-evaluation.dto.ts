import { PartialType } from '@nestjs/swagger';
import { CreateProgressEvaluationDto } from './create-progress-evaluation.dto';

export class UpdateProgressEvaluationDto extends PartialType(
  CreateProgressEvaluationDto,
) {}
