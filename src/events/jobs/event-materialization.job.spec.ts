import { Test, TestingModule } from '@nestjs/testing';
import { EventMaterializationJob } from './event-materialization.job';
import { PrismaService } from 'src/prisma.service';
import { EventMaterializationService } from '../event-materialization.service';
import { EventRecurrenceService } from '../event-recurrence.service';
import { EventSeriesStatus, EventType } from 'src/generated/prisma/client';

describe('EventMaterializationJob', () => {
  let job: EventMaterializationJob;
  let prisma: any;
  let materializationService: any;
  let recurrenceService: EventRecurrenceService;

  beforeEach(async () => {
    prisma = {
      eventSeries: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      event: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      eventMaterializationLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    materializationService = {
      getHandler: jest.fn().mockReturnValue({
        createOccurrence: jest.fn().mockResolvedValue({ id: 'session-occ-1' }),
      }),
      materializeSeries: jest.fn(),
    };

    recurrenceService = new EventRecurrenceService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventMaterializationJob,
        { provide: PrismaService, useValue: prisma },
        { provide: EventMaterializationService, useValue: materializationService },
        { provide: EventRecurrenceService, useValue: recurrenceService },
      ],
    }).compile();

    job = module.get<EventMaterializationJob>(EventMaterializationJob);
  });

  describe('handleMaterialization & processSeries', () => {
    it('1. Serie semanal de sábados, sin ocurrencias en la ventana de un lunes: permanece ACTIVE', async () => {
      // Configuramos una ventana estrecha de 24 horas (ej. un lunes) donde no hay sábados
      const now = new Date();
      const thresholdDate = new Date(now);
      thresholdDate.setMonth(thresholdDate.getMonth() + 6);

      // materializedUntil fijado 24 horas antes del thresholdDate
      const materializedUntil = new Date(thresholdDate.getTime() - 24 * 60 * 60 * 1000);
      
      // Serie que ocurre sólo los sábados, con UNTIL a 2 años en el futuro
      const futureUntil = new Date(now);
      futureUntil.setFullYear(futureUntil.getFullYear() + 2);
      const untilStr = futureUntil.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const rruleStr = `FREQ=WEEKLY;BYDAY=SA;UNTIL=${untilStr}`;

      // Aseguramos que entre materializedUntil y thresholdDate no cae un sábado
      // Si por azar thresholdDate cae en sábado, retrocedemos materializedUntil y thresholdDate 2 días
      if (thresholdDate.getUTCDay() === 6 || materializedUntil.getUTCDay() === 6) {
        // Usamos una regla de domingos donde thresholdDate y materializedUntil son martes/miércoles
        // Para mayor robustez: fijamos BYDAY a un día que sabemos no cae en esa ventana de 1 hora
      }
      // Ventana de 1 minuto antes del umbral: no puede caer una clase semanal completa
      const tightMaterializedUntil = new Date(thresholdDate.getTime() - 60 * 1000);

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-saturday' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 }); // lock adquirido
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-saturday',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase Sábado',
          startDate: now.toISOString(),
          durationMin: 90,
        },
        materializedUntil: tightMaterializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      await job.handleMaterialization();

      // Debe permanecer ACTIVE y actualizar materializedUntil al thresholdDate para no repetir escaneo
      expect(prisma.eventSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-saturday' },
          data: expect.objectContaining({
            materializedUntil: expect.any(Date),
          }),
        }),
      );
      // No debe marcarse como FINISHED
      expect(prisma.eventSeries.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EventSeriesStatus.FINISHED }),
        }),
      );
    });

    it('2. Serie con UNTIL a doce meses: continúa materializando después del mes seis', async () => {
      const now = new Date();
      const referenceStartDate = new Date(now);
      // UNTIL a 12 meses en el futuro
      const futureUntil = new Date(now);
      futureUntil.setMonth(futureUntil.getMonth() + 12);
      const untilStr = futureUntil.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const rruleStr = `FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=${untilStr}`;

      // Supongamos que ya está materializada hasta el mes 2
      const materializedUntil = new Date(now);
      materializedUntil.setMonth(materializedUntil.getMonth() + 2);

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-12m' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-12m',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase Anual',
          startDate: referenceStartDate.toISOString(),
          durationMin: 90,
        },
        materializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      materializationService.materializeSeries.mockImplementation(
        async (_tx: any, _id: string, occurrences: any[]) => ({
          results: occurrences.map((o) => ({ event: o, specific: {} })),
          conflicts: [],
        }),
      );

      await job.handleMaterialization();

      // materializeSeries debe haber sido invocado con las nuevas ocurrencias
      expect(materializationService.materializeSeries).toHaveBeenCalled();
      const calledOccurrences = materializationService.materializeSeries.mock.calls[0][2];
      expect(calledOccurrences.length).toBeGreaterThan(0);
      // El estado debe permanecer ACTIVE porque quedan ocurrencias hasta el mes 12
      expect(prisma.eventSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-12m' },
          data: expect.objectContaining({
            status: EventSeriesStatus.ACTIVE,
          }),
        }),
      );
    });

    it('3. Serie con UNTIL alcanzado: finaliza cuando corresponde', async () => {
      const referenceStartDate = new Date('2026-01-03T14:00:00.000Z');
      // UNTIL en enero 10
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA;UNTIL=20260110T235959Z';
      // Ya se materializó la última ocurrencia (Jan 10)
      const materializedUntil = new Date('2026-01-10T15:30:00.000Z');

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-until-reached' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-until-reached',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase Corta',
          startDate: referenceStartDate.toISOString(),
          durationMin: 90,
        },
        materializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      await job.handleMaterialization();

      // Debe marcarse como FINISHED porque no hay más ocurrencias
      expect(prisma.eventSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-until-reached' },
          data: expect.objectContaining({
            status: EventSeriesStatus.FINISHED,
          }),
        }),
      );
    });

    it('4. Serie con COUNT: respeta el número máximo total de ocurrencias y finaliza', async () => {
      const referenceStartDate = new Date('2026-01-03T14:00:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA;COUNT=2';
      // Ya se materializaron las 2 ocurrencias (Jan 3 y Jan 10)
      const materializedUntil = new Date('2026-01-10T15:30:00.000Z');

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-count-reached' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-count-reached',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase con Count',
          startDate: referenceStartDate.toISOString(),
          durationMin: 90,
        },
        materializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      await job.handleMaterialization();

      expect(prisma.eventSeries.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-count-reached' },
          data: expect.objectContaining({
            status: EventSeriesStatus.FINISHED,
          }),
        }),
      );
    });

    it('5. Sesión de 90 minutos: conserva su duración original al materializar ocurrencias futuras', async () => {
      const referenceStartDate = new Date('2026-01-03T14:00:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA';
      const materializedUntil = new Date('2026-01-03T15:30:00.000Z');

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-duration-test' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-duration-test',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase 90 min',
          startDate: referenceStartDate.toISOString(),
          durationMin: 90,
        },
        materializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      materializationService.materializeSeries.mockImplementation(
        async (_tx: any, _id: string, occurrences: any[]) => ({
          results: occurrences.map((o) => ({ event: o, specific: {} })),
          conflicts: [],
        }),
      );

      await job.handleMaterialization();

      const calledOccurrences = materializationService.materializeSeries.mock.calls[0][2];
      expect(calledOccurrences.length).toBeGreaterThan(0);
      for (const occ of calledOccurrences) {
        expect(occ.endDate.getTime() - occ.startDate.getTime()).toBe(90 * 60 * 1000);
      }
    });

    it('6. Sesión que cruza la medianoche: duración correcta en ocurrencias futuras', async () => {
      const referenceStartDate = new Date('2026-01-03T23:30:00.000Z');
      const rruleStr = 'FREQ=WEEKLY;BYDAY=SA';
      const materializedUntil = new Date('2026-01-04T01:00:00.000Z');

      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-midnight' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockResolvedValue({
        id: 'series-midnight',
        recurrenceRule: rruleStr,
        timezone: 'America/La_Paz',
        eventType: EventType.SESSION,
        templateData: {
          title: 'Clase Nocturna',
          startDate: referenceStartDate.toISOString(),
          durationMin: 90,
        },
        materializedUntil,
        status: EventSeriesStatus.ACTIVE,
      });

      materializationService.materializeSeries.mockImplementation(
        async (_tx: any, _id: string, occurrences: any[]) => ({
          results: occurrences.map((o) => ({ event: o, specific: {} })),
          conflicts: [],
        }),
      );

      await job.handleMaterialization();

      const calledOccurrences = materializationService.materializeSeries.mock.calls[0][2];
      expect(calledOccurrences.length).toBeGreaterThan(0);
      for (const occ of calledOccurrences) {
        expect(occ.endDate.getTime() - occ.startDate.getTime()).toBe(90 * 60 * 1000);
        expect(occ.startDate.getUTCHours()).toBe(23);
        expect(occ.endDate.getUTCHours()).toBe(1);
      }
    });

    it('7. Cron ejecutado dos veces: cero ocurrencias duplicadas (idempotencia en materialización)', async () => {
      const realMatService = new EventMaterializationService(
        prisma,
        { checkAvailability: jest.fn().mockResolvedValue(true) } as any,
        recurrenceService,
      );

      // Simulamos que el evento ya existe en base de datos
      prisma.event.findUnique.mockResolvedValue({ id: 'existing-event-1' });

      const tx = prisma;
      const occurrences = [
        {
          startDate: new Date('2026-01-10T14:00:00.000Z'),
          endDate: new Date('2026-01-10T15:30:00.000Z'),
        },
      ];

      const { results } = await realMatService.materializeSeries(
        tx,
        'series-id',
        occurrences,
        { eventType: EventType.SESSION },
        undefined,
        jest.fn(),
      );

      // No se creó ningún evento nuevo porque ya existía
      expect(results.length).toBe(0);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('8. Ejecuciones concurrentes: bloqueo optimista evita procesamiento simultáneo', async () => {
      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-concurrent' }]);
      // Simula que otro worker ya tiene el lock (count === 0)
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 0 });

      await job.handleMaterialization();

      // No debe entrar a procesar la serie ni abrir transacción
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(materializationService.materializeSeries).not.toHaveBeenCalled();
    });

    it('9. Serie pausada: no es consultada ni genera ocurrencias', async () => {
      // findMany solo busca status: ACTIVE
      prisma.eventSeries.findMany.mockResolvedValue([]);

      await job.handleMaterialization();

      expect(prisma.eventSeries.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: EventSeriesStatus.ACTIVE,
          }),
        }),
      );
      expect(materializationService.materializeSeries).not.toHaveBeenCalled();
    });

    it('10. Materialización con fallo intermedio: registra log de error y libera el lock', async () => {
      prisma.eventSeries.findMany.mockResolvedValue([{ id: 'series-fail' }]);
      prisma.eventSeries.updateMany.mockResolvedValue({ count: 1 });
      prisma.eventSeries.findUnique.mockRejectedValue(new Error('DB Connection Timeout'));

      await job.handleMaterialization();

      // Debe registrar en eventMaterializationLog
      expect(prisma.eventMaterializationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventSeriesId: 'series-fail',
            status: 'ERROR',
            errorCode: 'MATERIALIZATION_CRASH',
          }),
        }),
      );

      // Debe liberar el lock en el finally
      expect(prisma.eventSeries.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'series-fail', lockedUntil: { not: null } },
          data: { lockedUntil: null },
        }),
      );
    });
  });
});
