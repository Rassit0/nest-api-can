import { EventType, EventStatus } from 'src/generated/prisma/client';

export interface CalendarLocationDto {
  id: string;
  name: string;
}

export interface CalendarSeriesDto {
  id: string;
  isRecurring: boolean;
}

export interface BaseCalendarMetadata {
  [key: string]: any;
}

export interface SessionCalendarMetadata extends BaseCalendarMetadata {
  durationMin: number;
  teams: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
}

export interface MatchCalendarMetadata extends BaseCalendarMetadata {
  opponentName: string;
  matchType: string;
  result: string;
  team: { id: string; name: string } | null;
}

export interface GeneralEventCalendarMetadata extends BaseCalendarMetadata {
  institutionId: string | null;
  teamSeasonId: string | null;
  courseSeasonId: string | null;
}

export interface CalendarEventResponse<T = BaseCalendarMetadata> {
  id: string;
  title: string | null;
  type: EventType;
  startDate: Date;
  endDate: Date;
  status: EventStatus;
  color: string | null;
  location: CalendarLocationDto | null;
  series: CalendarSeriesDto | null;
  metadata: T;
}
