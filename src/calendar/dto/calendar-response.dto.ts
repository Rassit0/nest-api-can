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
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  matchType: string;
  result: string;
  category: { id: string; name: string } | null;
}

export interface GeneralEventCalendarMetadata extends BaseCalendarMetadata {
  institutionId: string | null;
  teamSeasonCategoryId: string | null;
  courseSeasonId: string | null;
  courseSeasonShiftId: string | null;
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
