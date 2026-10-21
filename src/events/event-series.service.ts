import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

      // Calcular fecha límite para preservar sesiones pasadas
      const cutoffDate = scope === 'all' ? now : (event.originalStartDate > now ? event.originalStartDate : now);

      // Guard: Proteger ocurrencias que tengan datos operativos (asistencias, incidentes, cobros)
      const protectedEvents = await tx.event.findMany({
        where: {
          eventSeriesId: series.id,
          startDate: { gte: cutoffDate },
          OR: [
            {
              session: {
                bookings: {
                  some: {
                    OR: [
                      { attended: true },
                      { chargeId: { not: null } },
                      { incidents: { some: {} } },
                    ],
                  },
                },
              },
            },
            {
              match: {
                result: { not: 'PENDING' },
              },
            },
          ],
        },
        select: { id: true, title: true, startDate: true },
      });

      if (protectedEvents.length > 0) {
        throw new BadRequestException(
          `No se puede modificar la serie porque existen ${protectedEvents.length} sesión(es) con asistencia tomada, incidentes o cobros registrados. Edite las sesiones individualmente.`,
        );
      }

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

        const durationMs = event.endDate && event.startDate 
          ? (event.endDate.getTime() - event.startDate.getTime()) 
          : (90 * 60 * 1000);

        const horizonDate = new Date(now);
        horizonDate.setMonth(horizonDate.getMonth() + 6);

        // Regenerar desde 'now' hasta un límite de 6 meses preservando la duración original
        const occurrences = this.recurrenceService.expandRRuleWindow({
          rruleStr: newBaseData.recurrenceRule,
          referenceStartDate: event.startDate,
          durationMs,
          windowStartDate: now,
          windowEndDate: horizonDate,
        });

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
        // 1. Eliminar eventos de esta serie de cutoffDate en adelante
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: cutoffDate }
          }
        });

        // 2. Truncar serie antigua
        await this.truncateSeries(tx, series, cutoffDate, userId);

        const durationMs = event.endDate && event.startDate 
          ? (event.endDate.getTime() - event.startDate.getTime()) 
          : (90 * 60 * 1000);

        const horizonDate = new Date(cutoffDate);
        horizonDate.setMonth(horizonDate.getMonth() + 6);

        // 3. Crear nueva serie (EventSeries B)
        const occurrences = this.recurrenceService.expandRRuleWindow({
          rruleStr: newBaseData.recurrenceRule,
          referenceStartDate: event.startDate,
          durationMs,
          windowStartDate: cutoffDate,
          windowEndDate: horizonDate,
        });

        const lastOccurrence = occurrences.length > 0 ? occurrences[occurrences.length - 1].endDate : cutoffDate;

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
      const now = new Date();
      const cutoffDate = scope === 'all' ? now : (event.originalStartDate > now ? event.originalStartDate : now);

      // Guard: Proteger ocurrencias que tengan datos operativos (reservas, asistencias, incidentes, cobros)
      const protectedEvents = await tx.event.findMany({
        where: {
          eventSeriesId: series.id,
          startDate: { gte: cutoffDate },
          OR: [
            {
              session: {
                bookings: {
                  some: {}, // Protege cualquier booking existente (reservas, asistencias o ausencias registradas)
                },
              },
            },
            {
              match: {
                result: { not: 'PENDING' },
              },
            },
          ],
        },
        select: { id: true, title: true, startDate: true },
      });

      if (protectedEvents.length > 0) {
        throw new BadRequestException(
          `No se puede eliminar la serie porque existen ${protectedEvents.length} sesión(es) con reservas de participantes, asistencia tomada, incidentes o cobros registrados. Cancele las ocurrencias individualmente.`,
        );
      }

      if (scope === 'all') {
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
        // Borrar eventos a partir de cutoffDate
        await tx.event.deleteMany({
          where: {
            eventSeriesId: series.id,
            startDate: { gte: cutoffDate }
          }
        });
        // Truncar serie en cutoffDate
        await this.truncateSeries(tx, series, cutoffDate);
      }
      
      return { deleted: true };
    });
  }
}
