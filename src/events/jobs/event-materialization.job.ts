import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma.service';
import { EventMaterializationService } from '../event-materialization.service';
import { EventRecurrenceService } from '../event-recurrence.service';
import { EventSeriesStatus } from 'src/generated/prisma/client';

import { envs } from 'src/config/envs';

@Injectable()
export class EventMaterializationJob {
  private readonly logger = new Logger(EventMaterializationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly materializationService: EventMaterializationService,
    private readonly recurrenceService: EventRecurrenceService,
  ) {}

  @Cron('0 2 * * *', {
    timeZone: envs.appTimezone,
  })
  async handleMaterialization() {
    this.logger.log(
      'Iniciando cron de materialización de series recurrentes...',
    );

    // Umbral: Queremos materializar siempre hasta 6 meses en el futuro.
    // Si una serie tiene materializedUntil < thresholdDate, la procesamos.
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() + 6);

    // Obtenemos las series candidatas que no están bloqueadas o cuyo bloqueo expiró hace más de 1 hora (por si acaso un pod murió)
    const now = new Date();
    const lockExpiryTime = new Date(now.getTime() - 1000 * 60 * 60);

    const candidateSeries = await this.prisma.eventSeries.findMany({
      where: {
        status: EventSeriesStatus.ACTIVE,
        materializedUntil: {
          lt: thresholdDate,
        },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      select: { id: true },
      take: 50, // Procesar en lotes
    });

    if (candidateSeries.length === 0) {
      this.logger.debug('No hay series candidatas para materializar.');
      return;
    }

    this.logger.log(`Encontradas ${candidateSeries.length} series candidatas.`);

    for (const { id } of candidateSeries) {
      await this.processSeries(id, thresholdDate);
    }
  }

  private async processSeries(seriesId: string, thresholdDate: Date) {
    const lockTime = new Date();
    lockTime.setMinutes(lockTime.getMinutes() + 5); // 5 minutos de lock

    // Intento de tomar lock (Optimistic Locking)
    const { count } = await this.prisma.eventSeries.updateMany({
      where: {
        id: seriesId,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: {
        lockedUntil: lockTime,
      },
    });

    if (count === 0) {
      this.logger.debug(
        `Serie ${seriesId} ya está bloqueada por otro worker. Se omitirá.`,
      );
      return;
    }

    this.logger.log(`Procesando serie ${seriesId}...`);
    let transactionSuccess = false;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const series = await tx.eventSeries.findUnique({
            where: { id: seriesId },
          });

          if (!series || !series.materializedUntil) {
            throw new Error('Serie no encontrada o sin materializedUntil');
          }

          // 1. Obtener duración original y fecha de referencia de la recurrencia
          const template = (series.templateData as any) || {};
          let durationMs: number | null = null;
          let referenceStartDate: Date | null = null;

          if (typeof template.durationMin === 'number' && template.durationMin > 0) {
            durationMs = template.durationMin * 60 * 1000;
          } else if (template.startDate && template.endDate) {
            const s = new Date(template.startDate).getTime();
            const e = new Date(template.endDate).getTime();
            if (e > s) durationMs = e - s;
          }

          if (template.startDate) {
            const d = new Date(template.startDate);
            if (!isNaN(d.getTime())) referenceStartDate = d;
          }

          // Fallback a eventos preexistentes de la serie
          if (!durationMs || !referenceStartDate) {
            const firstEvent = await tx.event.findFirst({
              where: { eventSeriesId: series.id },
              select: { startDate: true, endDate: true },
              orderBy: { startDate: 'asc' },
            });
            if (firstEvent) {
              if (!referenceStartDate) referenceStartDate = firstEvent.startDate;
              if (!durationMs && firstEvent.endDate) {
                durationMs = firstEvent.endDate.getTime() - firstEvent.startDate.getTime();
              }
            }
          }

          if (!durationMs || durationMs <= 0) {
            durationMs = 90 * 60 * 1000; // 90 min institucional por defecto
          }
          if (!referenceStartDate) {
            referenceStartDate = series.createdAt;
          }

          // 2. Determinar las próximas fechas desde materializedUntil + 1ms hasta thresholdDate
          const startExpansion = new Date(
            series.materializedUntil.getTime() + 1,
          );
          const occurrences = this.recurrenceService.expandRRuleWindow({
            rruleStr: series.recurrenceRule,
            referenceStartDate,
            durationMs,
            windowStartDate: startExpansion,
            windowEndDate: thresholdDate,
          });

          // 3. Evaluar conclusión real de la serie mediante semántica formal RRULE
          const isCompleted = this.recurrenceService.isSeriesCompleted(
            series.recurrenceRule,
            referenceStartDate,
            series.materializedUntil,
          );

          if (occurrences.length === 0) {
            if (isCompleted) {
              await tx.eventSeries.update({
                where: { id: series.id },
                data: { status: EventSeriesStatus.FINISHED },
              });
              this.logger.log(`Serie ${series.id} completó todas sus ocurrencias programadas.`);
            } else {
              // La ventana actual no tiene ocurrencias (ej. intervalo sin clases), pero la serie continúa vigente.
              // Avanzamos materializedUntil a thresholdDate para evitar re-escaneo redundante y mantenemos ACTIVE.
              await tx.eventSeries.update({
                where: { id: series.id },
                data: { materializedUntil: thresholdDate },
              });
              this.logger.debug(`Serie ${series.id} sin ocurrencias hasta ${thresholdDate.toISOString()}, permanece ACTIVE.`);
            }
            return;
          }

          const handler = this.materializationService.getHandler(
            series.eventType,
          );

          const baseData = {
            eventType: series.eventType,
            recurrenceRule: series.recurrenceRule,
            timezone: series.timezone,
            title: template.title,
            description: template.description,
            color: template.color,
            locationId: template.locationId,
          };

          const { results, conflicts } =
            await this.materializationService.materializeSeries(
              tx,
              series.id,
              occurrences,
              baseData,
              undefined, // Sistema, sin userId
              (t, eid) => handler.createOccurrence(t, eid, series.templateData),
              true, // skipConflicts = BEST_EFFORT
            );

          const newMaterializedUntil =
            occurrences[occurrences.length - 1].endDate;

          // Verificar si tras materializar este lote la serie ya no tiene más ocurrencias futuras
          const hasMoreOccurrences = !this.recurrenceService.isSeriesCompleted(
            series.recurrenceRule,
            referenceStartDate,
            newMaterializedUntil,
          );

          await tx.eventSeries.update({
            where: { id: series.id },
            data: {
              materializedUntil: newMaterializedUntil,
              lastMaterializedAt: new Date(),
              status: hasMoreOccurrences ? EventSeriesStatus.ACTIVE : EventSeriesStatus.FINISHED,
            },
          });

          // Guardar logs de conflictos si los hubo (Auditoría)
          if (conflicts.length > 0) {
            await tx.eventMaterializationLog.create({
              data: {
                eventSeriesId: series.id,
                generatedDate: new Date(),
                status: 'BEST_EFFORT_CONFLICT',
                metadata: {
                  totalGenerated: results.length,
                  totalConflicts: conflicts.length,
                  conflicts,
                },
              },
            });
          }

          this.logger.log(
            `Serie ${series.id} procesada exitosamente. Se generaron ${results.length} ocurrencias (Conflictos: ${conflicts.length}).`,
          );
        },
        { timeout: 30000 },
      ); // 30s de timeout para la transaccion

      transactionSuccess = true;
    } catch (error) {
      this.logger.error(
        `Error procesando serie ${seriesId}: ${error.message}`,
        error.stack,
      );

      // Intentar registrar el error (fuera de la transacción abortada)
      try {
        await this.prisma.eventMaterializationLog.create({
          data: {
            eventSeriesId: seriesId,
            generatedDate: new Date(),
            status: 'ERROR',
            errorCode: 'MATERIALIZATION_CRASH',
            metadata: { error: error.message },
          },
        });
      } catch (logError) {
        this.logger.error(
          `Error al registrar el log de materialización: ${logError.message}`,
        );
      }
    } finally {
      // Liberar el lock
      await this.prisma.eventSeries.updateMany({
        where: { id: seriesId, lockedUntil: { not: null } },
        data: { lockedUntil: null },
      });
    }
  }
}
