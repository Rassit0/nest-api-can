import { PartialType } from '@nestjs/mapped-types';
import { CreateGeneralEventDto } from './create-general-event.dto';

export class UpdateGeneralEventDto extends PartialType(CreateGeneralEventDto) {}
