import { PartialType } from '@nestjs/swagger';
import { CreateSessionBookingDto } from './create-session-booking.dto';

export class UpdateSessionBookingDto extends PartialType(
  CreateSessionBookingDto,
) {}
