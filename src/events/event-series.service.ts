import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { EventMaterializationService } from './event-materialization.service';
import { EventRecurrenceService } from './event-recurrence.service';
import { Prisma, EventSeriesStatus } from 'src/generated/prisma/client';
import { BaseEventCreateDto } from './dto/base-event.dto';

@Injectable()
export class EventSeriesService {
  private readonly logger = new Logger('EventSeriesService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly materializationService: EventMaterializationService,
    private readonly recurrenceService: EventRecurrenceService,
  ) {}

  /**
   * Crea una nueva serie de eventos y la materializa.
   * Transaccional.
   */
  async createSeries<T>(
    baseData: BaseEventCreateDto,
    templateData: any,
    userId: string | undefined,
    specificCallback: (tx: Prisma.TransactionClient, eventId: string) => Promise<T>,
    skipConflicts: boolean = false
  ): Promise<{ eventSeries: any; results: any[]; conflicts: any[] }> {
    if (!baseData.recurrenceRule) {
      throw new Error('createSeries requiere una recurrenceRule');
    }

    const start = new Date(baseData.startDate);
    const end = new Date(baseData.endDate);

    const occurrences = this.recurrenceService.expandRRule(
      baseData.recurrenceRule,
      start,
      end
    );

    if (occurrences.length === 0) {
      throw new Error('La regla de recurrencia no genera ninguna ocurrencia en el rango especificado');
    }

    return await this.prisma.$transaction(async (tx) => {
      const lastOccurrence = occurrences[occurrences.length - 1];
      
      const eventSeries = await tx.eventSeries.create({
        data: {
          recurrenceRule: baseData.recurrenceRule!,
          timezone: baseData.timezone || 'America/La_Paz',
          eventType: baseData.eventType,
          templateData: templateData as any,
          materializedUntil: lastOccurrence.endDate,
          status: EventSeriesStatus.ACTIVE,
          ...(userId && { createdById: userId, updatedById: userId }),
        }
      });

      const { results, conflicts } = await this.materializationService.materializeSeries(
        tx,
        eventSeries.id,
        occurrences,
        baseData,
        userId,
        specificCallback,
        skipConflicts
      );

      return { eventSeries, results, conflicts };
    });
  }

/**
   * Trunca una serie ajustando materializedUntil.
   * Opcionalmente ajusta la regla RRULE añadiendo un UNTIL.
   */
  private async truncateSeries(tx: Prisma.TransactionClient, eventSeries: any, beforeDate: Date, userId?: string) {
    let newRRule = eventSeries.recurrenceRule;
    if (!newRRule.includes('UNTIL=')) {
      // Very basic approach to add UNTIL. Real implementation might need RRule parsing.
      const untilDateStr = beforeDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      newRRule = `${newRRule};UNTIL=${untilDateStr}`;
    }
    
    await tx.eventSeries.update({
      where: { id: eventSeries.id },
      data: {
        recurrenceRule: newRRule,
        materializedUntil: new Date(beforeDate.getTime() - 1),
        ...(userId && { updatedById: userId }),
      }
    });
  }

  /**
   * Actualiza una serie existente dependiendo del scope.
   */
  async updateSeries<T>(
    eventId: string,
    baseDataUpdate: Partial<BaseEventCreateDto>, 
    userId: string | undefined,
    scope: 'following' | 'all',
    mergeTemplate: (oldTemplate: any) => any,
    occurrenceHandler: (tx: Prisma.TransactionClient, newEventId: string, templateData: any) => Promise<T>
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch Event with Series (SELECT FOR UPDATE logically)
      // Since prisma doesn't support SELECT FOR UPDATE out of the box nicely for relations without raw queries,
      // we'll rely on the transaction isolation level. 
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { eventSeries: true },
      });

      if (!event || !event.eventSeries) {
        throw new Error('El evento no pertenece a una serie.');
      }

      const series = event.eventSeries;
      const originalStartDate = event.originalStartDate;
      const now = new Date();

      // Mezclar el template
      const newTemplateData = mergeTemplate(series.templateData);

      // Determinar nueva baseData
      const newBaseData = {
        eventType: series.eventType,
        title: baseDataUpdate.title !== undefined ? baseDataUpdate.title : event.title,
        description: baseDataUpdate.description !== undefined ? baseDataUpdate.description : event.description,
        color: baseDataUpdate.color !== undefined ? baseDataUpdate.color : event.color,
        locationId: baseDataUpdate.locationId !== undefined ? baseDataUpdate.locationId : event.locationId,
        recurrenceRule: baseDataUpdate.recurrenceRule || series.recurrenceRule,
        timezone: series.timezone,
      };

      if (scope === 'all') {
        // Eliminar ocurrencias futuras
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: now }
          }
        });

        // Actualizar la serie existente con el nuevo RRULE y template
        const updatedSeries = await tx.eventSeries.update({
          where: { id: series.id },
          data: {
            recurrenceRule: newBaseData.recurrenceRule,
            templateData: newTemplateData,
            ...(userId && { updatedById: userId })
          }
        });

        // Regenerar desde 'now' hasta un límite (por ejemplo, expandiendo RRULE desde now)
        // Obtenemos las nuevas fechas
        const occurrences = this.recurrenceService.expandRRule(
          newBaseData.recurrenceRule,
          now, // start from now
          new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 2) // expand up to 2 years, or whatever the limit is
        );

        if (occurrences.length > 0) {
           await tx.eventSeries.update({
             where: { id: series.id },
             data: { materializedUntil: occurrences[occurrences.length - 1].endDate }
           });

           await this.materializationService.materializeSeries(
             tx,
             series.id,
             occurrences,
             newBaseData,
             userId,
             (t, eid) => occurrenceHandler(t, eid, newTemplateData),
             true // BEST_EFFORT
           );
        }

        return { message: 'Serie actualizada completamente (eventos futuros regenerados)' };
      }

      if (scope === 'following') {
        // 1. Eliminar eventos de esta serie de originalStartDate en adelante
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: originalStartDate }
          }
        });

        // 2. Truncar serie antigua
        await this.truncateSeries(tx, series, originalStartDate, userId);

        // 3. Crear nueva serie (EventSeries B)
        const occurrences = this.recurrenceService.expandRRule(
          newBaseData.recurrenceRule,
          originalStartDate, // from originalStartDate
          new Date(originalStartDate.getTime() + 1000 * 60 * 60 * 24 * 365 * 2) // up to 2 years limit
        );

        const lastOccurrence = occurrences.length > 0 ? occurrences[occurrences.length - 1].endDate : originalStartDate;

        const newSeries = await tx.eventSeries.create({
          data: {
            recurrenceRule: newBaseData.recurrenceRule,
            timezone: series.timezone,
            eventType: series.eventType,
            templateData: newTemplateData,
            materializedUntil: lastOccurrence,
            status: EventSeriesStatus.ACTIVE,
            ...(userId && { createdById: userId, updatedById: userId }),
          }
        });

        // 4. Materializar bajo la nueva serie
        if (occurrences.length > 0) {
           await this.materializationService.materializeSeries(
             tx,
             newSeries.id,
             occurrences,
             newBaseData,
             userId,
             (t, eid) => occurrenceHandler(t, eid, newTemplateData),
             true // BEST_EFFORT
           );
        }

        return { message: 'Serie actualizada desde este evento (se creó una nueva serie)' };
      }
    });
  }

  /**
   * Elimina una serie existente dependiendo del scope.
   */
  async deleteSeries(
    eventId: string,
    scope: 'following' | 'all'
  ) {
    return await this.prisma.$transaction(async (tx) => {
       const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { eventSeries: true },
      });
      
      if (!event || !event.eventSeriesId) {
        throw new Error('El evento no pertenece a una serie.');
      }

      const series = event.eventSeries;

      if (scope === 'all') {
        const now = new Date();
        // Borrar eventos futuros
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: now }
          }
        });
        // Truncar serie en 'now'
        await this.truncateSeries(tx, series, now);
        
        // Change status to CANCELLED instead of ACTIVE?
        await tx.eventSeries.update({
          where: { id: series.id },
          data: { status: EventSeriesStatus.PAUSED }
        });

      } else if (scope === 'following') {
        // Borrar eventos a partir de event.originalStartDate
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: event.originalStartDate }
          }
        });
        // Truncar serie en originalStartDate
        await this.truncateSeries(tx, series, event.originalStartDate);
      }
      
      return { deleted: true };
    });
  }
}
