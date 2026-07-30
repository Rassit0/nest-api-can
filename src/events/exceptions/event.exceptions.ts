import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

export enum EventErrorCode {
  EVENT_CONFLICT = 'EVENT_CONFLICT',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  PARENT_LOCATION_OCCUPIED = 'PARENT_LOCATION_OCCUPIED',
  CHILD_LOCATION_OCCUPIED = 'CHILD_LOCATION_OCCUPIED',
  INVALID_EVENT_RANGE = 'INVALID_EVENT_RANGE',
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
}

interface EventConflictMetadata {
  locationId: string;
  startDate: Date;
  endDate: Date;
  conflictingEventId?: string;
  conflictingEventTitle?: string;
}

export interface SeriesConflictDetail {
  index: number;
  startDate: Date;
  endDate: Date;
  reason: string;
  locationId?: string;
  conflictingEventId?: string;
  conflictingEventTitle?: string;
}

export interface EventSeriesConflictMetadata {
  totalOccurrences: number;
  conflictsCount: number;
  conflicts: SeriesConflictDetail[];
}

/**
 * Thrown when an event cannot be scheduled due to a scheduling collision.
 * Returns HTTP 409 Conflict.
 */
export class EventConflictException extends ConflictException {
  constructor(reason: string, errorCode: EventErrorCode, metadata?: EventConflictMetadata) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: reason,
      errorCode, // Custom internal code (e.g. EVENT_CONFLICT, LOCATION_UNAVAILABLE)
      metadata,  // Useful info for frontend (dates, location, conflicting event)
    });
  }
}

/**
 * Thrown when attempting to create a series of events and one or more occurrences
 * conflict with existing events.
 * Returns HTTP 409 Conflict.
 */
export class EventSeriesConflictException extends ConflictException {
  constructor(reason: string, errorCode: EventErrorCode, metadata: EventSeriesConflictMetadata) {
    super({
      statusCode: 409,
      error: 'Conflict',
      message: reason,
      errorCode,
      metadata,
    });
  }
}

/**
 * Thrown when event data is semantically invalid (e.g. endDate < startDate).
 * Returns HTTP 400 Bad Request.
 */
export class EventValidationException extends BadRequestException {
  constructor(message: string, errorCode: EventErrorCode = EventErrorCode.INVALID_EVENT_RANGE) {
    super({
      statusCode: 400,
      error: 'Bad Request',
      message,
      errorCode,
    });
  }
}

/**
 * Thrown when an event or its context entity cannot be found.
 * Returns HTTP 404 Not Found.
 */
export class EventNotFoundException extends NotFoundException {
  constructor(message: string, errorCode: EventErrorCode = EventErrorCode.EVENT_NOT_FOUND) {
    super({
      statusCode: 404,
      error: 'Not Found',
      message,
      errorCode,
    });
  }
}
