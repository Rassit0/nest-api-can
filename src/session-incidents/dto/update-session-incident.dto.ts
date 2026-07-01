import { PartialType } from '@nestjs/swagger';
import { CreateSessionIncidentDto } from './create-session-incident.dto';

export class UpdateSessionIncidentDto extends PartialType(
  CreateSessionIncidentDto,
) {}
