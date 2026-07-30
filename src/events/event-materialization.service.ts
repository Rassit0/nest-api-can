import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AvailabilityEngine } from './engines/availability.engine';
import { EventRecurrenceService } from './event-recurrence.service';
import { Prisma, EventType } from 'src/generated/prisma/client';
import { EventSeriesConflictException, EventErrorCode } from './exceptions/event.exceptions';

export interface IEventOccurrenceHandler {
  eventType: EventType;
  createOccurrence(tx: Prisma.TransactionClient, eventId: string, templateData: any): Promise<any>;
}

@Injectable()
export class EventMaterializationService {
  private readonly logger = new Logger('EventMaterializationService');

  private readonly handlers = new Map<EventType, IEventOccurrenceHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityEngine: AvailabilityEngine,
    private readonly recurrenceService: EventRecurrenceService,
  ) {}

  registerHandler(handler: IEventOccurrenceHandler) {
    if (this.handlers.has(handler.eventType)) {
      throw new Error(`A handler for EventType ${handler.eventType} is already registered. Overwriting is not allowed.`);
    }
    this.handlers.set(handler.eventType, handler);
    this.logger.log(`Registered handler for EventType: ${handler.eventType}`);
  }

  getHandler(eventType: EventType): IEventOccurrenceHandler {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      throw new Error(`No handler registered for EventType: ${eventType}`);
    }
    return handler;
  }

  /**
   * Ejecuta un preview de la materialización sin guardar en BD (BEST_EFFORT mode).
   */
  async previewSeries(
    baseData: { startDate: Date; endDate: Date; locationId?: string | null; recurrenceRule: string; timezone?: string },
  ) {
    if (!baseData.recurrenceRule) return null;

    const occurrences = this.recurrenceService.expandRRule(
      baseData.recurrenceRule,
      baseData.startDate,
      baseData.endDate
    );

    const conflicts: any[] = [];
    let validCount = 0;

    if (baseData.locationId) {
      for (let i = 0; i < occurrences.length; i++) {
        const occ = occurrences[i];
        const isAvailable = await this.availabilityEngine.checkAvailability({
          locationId: baseData.locationId,
          startDate: occ.startDate,
          endDate: occ.endDate,
        });

        if (isAvailable !== true) {
          let errorCode = EventErrorCode.EVENT_CONFLICT;
          if (isAvailable.reason === 'LOCATION_OCCUPIED') errorCode = EventErrorCode.LOCATION_UNAVAILABLE;
          if (isAvailable.reason === 'PARENT_LOCATION_OCCUPIED') errorCode = EventErrorCode.PARENT_LOCATION_OCCUPIED;
          if (isAvailable.reason === 'CHILD_LOCATION_OCCUPIED') errorCode = EventErrorCode.CHILD_LOCATION_OCCUPIED;

          conflicts.push({
            date: occ.startDate,
            reason: errorCode,
            eventId: isAvailable.conflictingEventId,
          });
        } else {
          validCount++;
        }
      }
    } else {
      validCount = occurrences.length;
    }

    return {
      simulation: true,
      totalOccurrences: occurrences.length,
      validCount,
      conflictsCount: conflicts.length,
      conflicts,
    };
  }

  /**
   * Materializa (crea) ocurrencias masivamente de una serie,
   * saltando conflictos si skipConflicts = true (BEST_EFFORT).
   */
  async materializeSeries<T>(
    tx: Prisma.TransactionClient,
    eventSeriesId: string,
    occurrences: Array<{startDate: Date, endDate: Date}>,
    baseData: {
      eventType: EventType,
      title?: string | null,
      description?: string | null,
      color?: string | null,
      locationId?: string | null,
    },
    userId: string | undefined,
    specificCallback: (tx: Prisma.TransactionClient, eventId: string) => Promise<T>,
    skipConflicts: boolean = false
  ) {
    const results = [];
    const conflicts = [];

    for (let i = 0; i < occurrences.length; i++) {
      const occ = occurrences[i];

      // Verificamos si este evento ya existe (Idempotencia)
      const existing = await tx.event.findUnique({
        where: {
          eventSeriesId_originalStartDate: {
            eventSeriesId,
            originalStartDate: occ.startDate,
          }
        }
      });

      if (existing) {
        continue; // Skip si ya está materializado
      }

      if (baseData.locationId) {
        const isAvailable = await this.availabilityEngine.checkAvailability({
          locationId: baseData.locationId,
          startDate: occ.startDate,
          endDate: occ.endDate,
        });

        if (isAvailable !== true) {
          if (!skipConflicts) {
             throw new EventSeriesConflictException(
              `La serie no pudo ser creada porque la ocurrencia en ${occ.startDate.toISOString()} presenta conflicto`,
              EventErrorCode.EVENT_CONFLICT,
              { 
                totalOccurrences: occurrences.length,
                conflictsCount: 1,
                conflicts: [{
                  index: i,
                  startDate: occ.startDate,
                  endDate: occ.endDate,
                  reason: isAvailable.reason,
                  conflictingEventId: isAvailable.conflictingEventId
                }] 
              }
             );
          } else {
             conflicts.push({
               date: occ.startDate,
               reason: isAvailable.reason,
               eventId: isAvailable.conflictingEventId,
             });
             continue; // Si estamos en BEST_EFFORT, saltamos esta ocurrencia
          }
        }
      }

      const event = await tx.event.create({
        data: {
          startDate: occ.startDate,
          endDate: occ.endDate,
          eventType: baseData.eventType,
          title: baseData.title,
          description: baseData.description,
          color: baseData.color,
          locationId: baseData.locationId,
          eventSeriesId: eventSeriesId,
          originalStartDate: occ.startDate,
          ...(userId && { createdById: userId, updatedById: userId }),
        },
      });

      const specific = await specificCallback(tx, event.id);
      results.push({ event, specific });
    }

    return { results, conflicts };
  }
}
