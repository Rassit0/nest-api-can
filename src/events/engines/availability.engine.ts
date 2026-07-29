import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CheckAvailabilityParams, CollisionError, IAvailabilityEngine } from './availability.interface';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class AvailabilityEngine implements IAvailabilityEngine {
  private readonly logger = new Logger(AvailabilityEngine.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(params: CheckAvailabilityParams): Promise<true | CollisionError> {
    const { startDate, endDate, locationId, excludeEventId } = params;

    this.logger.debug(`Checking availability for location ${locationId} from ${startDate} to ${endDate}`);

    // PostgreSQL Recursive CTE to find all Ancestors and Descendants
    // Then joins with events overlapping the requested time range
    // Returning flat results to check capacity in memory
    const overlappingEvents = await this.prisma.$queryRaw<
      {
        location_id: string;
        location_name: string;
        max_concurrent_events: number;
        tree_type: 'ANCESTOR_OR_SELF' | 'DESCENDANT';
        event_id: string;
        event_title: string;
      }[]
    >`
      WITH RECURSIVE Ancestors AS (
        SELECT id, parent_id, name, max_concurrent_events
        FROM locations 
        WHERE id = ${locationId}
        
        UNION ALL
        
        SELECT l.id, l.parent_id, l.name, l.max_concurrent_events
        FROM locations l
        INNER JOIN Ancestors a ON l.id = a.parent_id
      ),
      Descendants AS (
        SELECT id, parent_id, name, max_concurrent_events
        FROM locations 
        WHERE id = ${locationId}
        
        UNION ALL
        
        SELECT l.id, l.parent_id, l.name, l.max_concurrent_events
        FROM locations l
        INNER JOIN Descendants d ON l.parent_id = d.id
      ),
      LocationTree AS (
        SELECT id, name, max_concurrent_events, 'ANCESTOR_OR_SELF' as type 
        FROM Ancestors
        
        UNION
        
        SELECT id, name, max_concurrent_events, 'DESCENDANT' as type 
        FROM Descendants 
        WHERE id != ${locationId}
      )
      SELECT 
        lt.id as location_id, 
        lt.name as location_name,
        lt.max_concurrent_events, 
        lt.type as tree_type, 
        e.id as event_id, 
        e.title as event_title
      FROM LocationTree lt
      INNER JOIN events e ON e.location_id = lt.id 
      WHERE 
        e.start_date < ${endDate} AND e.end_date > ${startDate}
        AND (${excludeEventId}::text IS NULL OR e.id != ${excludeEventId})
    `;

    if (overlappingEvents.length === 0) {
      return true; // Fast path: No overlaps in the whole tree
    }

    // Group events by location to count concurrent usage
    const usageByLocation = new Map<string, {
      max: number;
      type: 'ANCESTOR_OR_SELF' | 'DESCENDANT';
      name: string;
      events: Array<{ id: string; title: string }>;
    }>();

    for (const row of overlappingEvents) {
      if (!usageByLocation.has(row.location_id)) {
        usageByLocation.set(row.location_id, {
          max: row.max_concurrent_events || 1, // Fallback to 1 if null
          type: row.tree_type,
          name: row.location_name,
          events: [],
        });
      }
      usageByLocation.get(row.location_id)!.events.push({
        id: row.event_id,
        title: row.event_title,
      });
    }

    // Evaluate capacity rules
    // 1. If any descendant is fully occupied, we cannot book the parent (because booking the parent means occupying ALL descendants)
    // 2. If an ancestor is fully occupied, we cannot book the child (because the ancestor is already at capacity with events spanning its area)
    // 3. If the exact location is fully occupied, we cannot book it.

    for (const [locId, usage] of usageByLocation.entries()) {
      // +1 because we are trying to add our new event to this location
      // Wait, if we book child A, does it consume 1 capacity of Ancestor? Yes, logically it consumes space in Ancestor.
      // But the query ONLY returns events directly assigned to Ancestor or Descendants.
      // E.g. If Ancestor has 1 event, and we book Child. usage.events.length = 1.
      // 1 (existing in Ancestor) + 1 (our new event in Child) > Ancestor.max (1). So blocked.
      if (usage.events.length >= usage.max) {
        let reason: CollisionError['reason'] = 'LOCATION_OCCUPIED';
        if (locId !== locationId) {
          reason = usage.type === 'ANCESTOR_OR_SELF' ? 'PARENT_LOCATION_OCCUPIED' : 'CHILD_LOCATION_OCCUPIED';
        }

        const conflictingEvent = usage.events[0]; // Take the first conflicting event for reporting

        this.logger.warn(`Collision detected at ${usage.name} (${reason}). Conflicting event: ${conflictingEvent.title}`);

        return {
          isAvailable: false,
          reason,
          conflictingEventId: conflictingEvent.id,
          conflictingEventTitle: conflictingEvent.title,
        };
      }
    }

    return true;
  }
}
