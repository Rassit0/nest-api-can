import { OmitType, PartialType } from '@nestjs/swagger';
import { AddShiftDto } from './add-shift.dto';

export class UpdateShiftDto extends PartialType(
  OmitType(AddShiftDto, ['shiftId'] as const),
) {}
