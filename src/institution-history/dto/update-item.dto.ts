import { PartialType } from '@nestjs/swagger';
import { CreateInstitutionHistoryItemDto } from './create-item.dto';

export class UpdateInstitutionHistoryItemDto extends PartialType(CreateInstitutionHistoryItemDto) {}
