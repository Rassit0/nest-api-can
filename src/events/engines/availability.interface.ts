export interface TimeRange {
  startDate: Date;
  endDate: Date;
}

export interface CollisionError {
  isAvailable: boolean;
  reason: 'LOCATION_OCCUPIED' | 'PARENT_LOCATION_OCCUPIED' | 'CHILD_LOCATION_OCCUPIED' | 'CAPACITY_EXCEEDED';
  conflictingEventId?: string;
  conflictingEventTitle?: string;
}

export interface CheckAvailabilityParams extends TimeRange {
  locationId: string;
  /**
   * If provided, the engine will ignore this specific event when checking for collisions.
   * Useful when updating an existing event so it doesn't collide with itself.
   */
  excludeEventId?: string;
}

export interface IAvailabilityEngine {
  /**
   * Checks if a given location is available during a specific time range.
   * It evaluates the location hierarchy (parents and children) and capacities.
   * 
   * @param params 
   * @returns true if available, otherwise throws or returns CollisionError
   */
  checkAvailability(params: CheckAvailabilityParams): Promise<true | CollisionError>;
}
