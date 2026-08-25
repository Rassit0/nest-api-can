import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateGeneralEventDto } from './dto/create-general-event.dto';
import { UpdateGeneralEventDto } from './dto/update-general-event.dto';
import { PrismaService } from 'src/prisma.service';
import { AvailabilityEngine } from './engines/availability.engine';
import { EventType, Prisma, EventExceptionType } from 'src/generated/prisma/client';
import { BaseEventCreateDto, BaseEventUpdateDto } from './dto/base-event.dto';
import {
  EventConflictException,
  EventErrorCode,
  EventNotFoundException,
  EventValidationException,
  EventSeriesConflictException,
} from './exceptions/event.exceptions';
import { EventRecurrenceService } from './event-recurrence.service';
import * as crypto from 'crypto';

import { EventSeriesService } from './event-series.service';
import { EventMaterializationService, IEventOccurrenceHandler } from './event-materialization.service';

@Injectable()
export class EventsService implements OnModuleInit, IEventOccurrenceHandler {
  private readonly logger = new Logger(EventsService.name);
  readonly eventType = EventType.GENERAL;

  constructor(
    private prisma: PrismaService,
    private availabilityEngine: AvailabilityEngine,
    private eventSeriesService: EventSeriesService,
    private eventMaterializationService: EventMaterializationService
  ) {}

  onModuleInit() {
    this.eventMaterializationService.registerHandler(this);
  }

  async createOccurrence(tx: Prisma.TransactionClient, eventId: string, templateData: any): Promise<any> {
    return tx.generalEvent.create({
      data: {
        eventId,
        institutionId: templateData.institutionId,
        teamSeasonCategoryId: templateData.teamSeasonCategoryId,
        courseSeasonId: templateData.courseSeasonId,
      }
    });
  }

  /**
   * Generic orchestrator for creating an Event and its specific child entity.
   */
  async executeEventCreation<T>(
    baseData: BaseEventCreateDto,
    userId: string | undefined,
    childDelegation: (tx: Prisma.TransactionClient, eventId: string) => Promise<T>,
  ): Promise<{ event: Prisma.EventGetPayload<any>; specific: T }> {
    const start = new Date(baseData.startDate);
    const end = new Date(baseData.endDate);

    if (start >= end) {
      throw new EventValidationException('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (baseData.locationId) {
      const isAvailable = await this.availabilityEngine.checkAvailability({
        locationId: baseData.locationId,
        startDate: start,
        endDate: end,
      });

      if (isAvailable !== true) {
        let errorCode = EventErrorCode.EVENT_CONFLICT;
        if (isAvailable.reason === 'LOCATION_OCCUPIED') errorCode = EventErrorCode.LOCATION_UNAVAILABLE;
        if (isAvailable.reason === 'PARENT_LOCATION_OCCUPIED') errorCode = EventErrorCode.PARENT_LOCATION_OCCUPIED;
        if (isAvailable.reason === 'CHILD_LOCATION_OCCUPIED') errorCode = EventErrorCode.CHILD_LOCATION_OCCUPIED;

        throw new EventConflictException(
          `El horario no está disponible: la locación ya está ocupada`,
          errorCode,
          {
            locationId: baseData.locationId,
            startDate: start,
            endDate: end,
            conflictingEventId: isAvailable.conflictingEventId,
            conflictingEventTitle: isAvailable.conflictingEventTitle,
          }
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const newEvent = await tx.event.create({
        data: {
          eventType: baseData.eventType,
          startDate: start,
          endDate: end,
          title: baseData.title,
          description: baseData.description,
          color: baseData.color,
          locationId: baseData.locationId,
          ...(userId && { createdById: userId, updatedById: userId }),
        },
      });

      const specific = await childDelegation(tx, newEvent.id);

      return { event: newEvent, specific };
    });
  }


  /**
   * Generic orchestrator for updating an Event and its specific child entity.
   */
  async executeEventUpdate<T>(
    eventId: string,
    baseData: BaseEventUpdateDto,
    userId: string | undefined,
    childDelegation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ event: Prisma.EventGetPayload<any>; specific: T }> {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      throw new EventNotFoundException('El evento padre no fue encontrado');
    }

    const start = baseData.startDate ? new Date(baseData.startDate) : existingEvent.startDate;
    const end = baseData.endDate ? new Date(baseData.endDate) : existingEvent.endDate;
    
    // Explicit null handles disconnection
    const targetLocationId = baseData.locationId !== undefined ? baseData.locationId : existingEvent.locationId;

    if (start >= end) {
      throw new EventValidationException('La fecha de inicio debe ser anterior a la fecha de fin');
    }

    if (
      (baseData.startDate && start.getTime() !== existingEvent.startDate.getTime()) ||
      (baseData.endDate && end.getTime() !== existingEvent.endDate.getTime()) ||
      targetLocationId !== existingEvent.locationId
    ) {
      if (targetLocationId) {
        const isAvailable = await this.availabilityEngine.checkAvailability({
          locationId: targetLocationId,
          startDate: start,
          endDate: end,
          excludeEventId: eventId,
        });

        if (isAvailable !== true) {
          let errorCode = EventErrorCode.EVENT_CONFLICT;
          if (isAvailable.reason === 'LOCATION_OCCUPIED') errorCode = EventErrorCode.LOCATION_UNAVAILABLE;
          if (isAvailable.reason === 'PARENT_LOCATION_OCCUPIED') errorCode = EventErrorCode.PARENT_LOCATION_OCCUPIED;
          if (isAvailable.reason === 'CHILD_LOCATION_OCCUPIED') errorCode = EventErrorCode.CHILD_LOCATION_OCCUPIED;

          throw new EventConflictException(
            `El horario no está disponible: la locación ya está ocupada`,
            errorCode,
            {
              locationId: targetLocationId,
              startDate: start,
              endDate: end,
              conflictingEventId: isAvailable.conflictingEventId,
              conflictingEventTitle: isAvailable.conflictingEventTitle,
            }
          );
        }
      }
    }

    const isMoved = 
      (baseData.startDate && start.getTime() !== existingEvent.startDate.getTime()) ||
      (baseData.endDate && end.getTime() !== existingEvent.endDate.getTime());
                    
    const isModified = !isMoved && (
      (baseData.title !== undefined && baseData.title !== existingEvent.title) ||
      (baseData.description !== undefined && baseData.description !== existingEvent.description) ||
      (baseData.color !== undefined && baseData.color !== existingEvent.color) ||
      (targetLocationId !== existingEvent.locationId)
    );

    let exceptionType = existingEvent.exceptionType;
    if (existingEvent.eventSeriesId) {
      if (isMoved) {
        exceptionType = EventExceptionType.MOVED;
      } else if (isModified && exceptionType !== EventExceptionType.MOVED) {
        exceptionType = EventExceptionType.MODIFIED;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.event.update({
        where: { id: eventId },
        data: {
          ...(baseData.startDate && { startDate: start }),
          ...(baseData.endDate && { endDate: end }),
          ...(baseData.title !== undefined && { title: baseData.title }),
          ...(baseData.description !== undefined && { description: baseData.description }),
          ...(baseData.color !== undefined && { color: baseData.color }),
          ...(baseData.locationId !== undefined ? { locationId: baseData.locationId } : {}),
          exceptionType,
          ...(userId && { updatedById: userId }),
        },
      });

      const specific = await childDelegation(tx);

      return { event: updatedEvent, specific };
    });
  }

  /**
   * Generic orchestrator for deleting an Event.
   */
  async executeEventDeletion(eventId: string) {
    const existingEvent = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!existingEvent) {
      throw new EventNotFoundException('El evento no fue encontrado');
    }

    if (existingEvent.eventSeriesId) {
      const cancelledEvent = await this.prisma.event.update({
        where: { id: eventId },
        data: { exceptionType: EventExceptionType.CANCELLED },
      });
      return { deleted: true, event: cancelledEvent };
    }

    // Prisma's onDelete: Cascade will handle deleting GeneralEvent/Session/Match
    const deletedEvent = await this.prisma.event.delete({
      where: { id: eventId },
    });

    return { deleted: true, event: deletedEvent };
  }

  // ---------------------------------------------------------
  // GeneralEvent implementation using the generic orchestrator
  // ---------------------------------------------------------

  async createGeneralEvent(createDto: CreateGeneralEventDto, userId?: string) {
    const { startDate, endDate, locationId, title, description, color, institutionId, teamSeasonCategoryId, courseSeasonId, courseSeasonShiftId, recurrenceRule, timezone } = createDto;

    const baseData: BaseEventCreateDto = {
      eventType: EventType.GENERAL,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      locationId,
      title,
      description,
      color,
      recurrenceRule,
      timezone,
    };



    const createSpecific = async (tx: Prisma.TransactionClient, eventId: string) => {
      return tx.generalEvent.create({
        data: {
          eventId,
          institutionId,
          teamSeasonCategoryId,
          courseSeasonId,
          courseSeasonShiftId,
        },
      });
    };

    if (recurrenceRule) {
      const { results } = await this.eventSeriesService.createSeries(baseData, createDto, userId, createSpecific);
      return results.map((r: any) => ({ ...r.event, generalEvent: r.specific }));
    } else {
      const result = await this.executeEventCreation(baseData, userId, createSpecific);
      return { ...result.event, generalEvent: result.specific };
    }
  }

  async updateGeneralEvent(id: string, updateDto: UpdateGeneralEventDto, userId?: string, scope: 'single' | 'following' | 'all' = 'single') {
    const generalEvent = await this.prisma.generalEvent.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!generalEvent) {
      throw new EventNotFoundException('GeneralEvent not found');
    }

    const { startDate, endDate, locationId, title, description, color, institutionId, teamSeasonCategoryId, courseSeasonId, courseSeasonShiftId, recurrenceRule, timezone } = updateDto;

    const baseData: Partial<BaseEventCreateDto> = {
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(locationId !== undefined && { locationId }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
      ...(timezone !== undefined && { timezone }),
    };

    if (generalEvent.event.eventSeriesId && scope !== 'single') {
      const mergeTemplate = (oldTemplate: any) => ({
        ...oldTemplate,
        ...(institutionId !== undefined && { institutionId }),
        ...(teamSeasonCategoryId !== undefined && { teamSeasonCategoryId }),
        ...(courseSeasonId !== undefined && { courseSeasonId }),
        ...(courseSeasonShiftId !== undefined && { courseSeasonShiftId }),
      });

      const occurrenceHandler = async (tx: Prisma.TransactionClient, newEventId: string, mergedTemplate: any) => {


        return tx.generalEvent.create({
          data: {
            eventId: newEventId,
            institutionId: mergedTemplate.institutionId,
            teamSeasonCategoryId: mergedTemplate.teamSeasonCategoryId,
            courseSeasonId: mergedTemplate.courseSeasonId,
            courseSeasonShiftId: mergedTemplate.courseSeasonShiftId,
          }
        });
      };

      return await this.eventSeriesService.updateSeries(id, baseData, userId, scope, mergeTemplate, occurrenceHandler);
    }



    const result = await this.executeEventUpdate(generalEvent.eventId, baseData, userId, async (tx) => {
      return tx.generalEvent.update({
        where: { id },
        data: {
          ...(institutionId !== undefined && { institutionId }),
          ...(teamSeasonCategoryId !== undefined && { teamSeasonCategoryId }),
          ...(teamSeasonCategoryId === null && { teamSeasonCategoryId: null }),
          ...(courseSeasonId !== undefined && { courseSeasonId }),
          ...(courseSeasonShiftId !== undefined && { courseSeasonShiftId }),
        },
      });
    });

    return { ...result.event, generalEvent: result.specific };
  }

  async deleteGeneralEvent(id: string, scope: 'single' | 'following' | 'all' = 'single') {
    const generalEvent = await this.prisma.generalEvent.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!generalEvent) {
      throw new EventNotFoundException('GeneralEvent not found');
    }

    if (generalEvent.event.eventSeriesId && scope !== 'single') {
      return await this.eventSeriesService.deleteSeries(id, scope);
    }

    await this.executeEventDeletion(generalEvent.eventId);

    return { deleted: true };
  }
}
