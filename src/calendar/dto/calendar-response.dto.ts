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
  sessionId: string;
  durationMin: number;
  teams: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
}

export interface MatchCalendarMetadata extends BaseCalendarMetadata {
  matchId: string;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  matchType: string;
  result: string;
  homeCategory: { id: string; name: string } | null;
  awayCategory: { id: string; name: string } | null;
  hasCallUps: boolean;
}

export interface GeneralEventCalendarMetadata extends BaseCalendarMetadata {
  generalEventId: string;
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
