import { EventType } from 'src/generated/prisma/client';

export interface BaseEventCreateDto {
  startDate: Date;
  endDate: Date;
  eventType: EventType;
  title?: string;
  description?: string;
  color?: string;
  locationId?: string;
  recurrenceRule?: string;
  timezone?: string;
}

export interface BaseEventUpdateDto {
  startDate?: Date;
  endDate?: Date;
  title?: string;
  description?: string;
  color?: string;
  locationId?: string | null;
  recurrenceRule?: string | null;
  timezone?: string | null;
}
