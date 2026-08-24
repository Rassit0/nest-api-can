import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateSessionBookingDto } from './create-session-booking.dto';

export class UpdateSessionBookingDto extends PartialType(
  OmitType(CreateSessionBookingDto, [
    'sessionId',
    'playerId',
    'studentId',
  ] as const),
) {}
