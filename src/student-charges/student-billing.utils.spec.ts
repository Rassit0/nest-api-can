import { getAbsoluteSeasonCycles, calculateCycleDates, findCycleContainingDate, calculateEffectiveBillablePeriod, calculateBillableDaysWithPauses, calculateCycleFeeFactor } from './student-billing.utils';
import { DateUtils } from 'src/utils/date.utils';

describe('student-billing.utils', () => {
  describe('getAbsoluteSeasonCycles (Motor Absoluto)', () => {
    it('MONTHLY: Debe generar ciclos absolutos consecutivos basándose en seasonStartDate', () => {
      // Season: 01/06/2026 -> 30/09/2026
      const start = new Date(Date.UTC(2026, 5, 1)); // Junio es 5
      const end = new Date(Date.UTC(2026, 8, 30)); // Septiembre es 8

      const cycles = getAbsoluteSeasonCycles(start, end, 'MONTHLY');

      expect(cycles.length).toBe(4);
      
      // Ciclo 1: 01/06 - 01/07
      expect(cycles[0].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 5, 1)).toISOString());
      expect(cycles[0].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 6, 1)).toISOString());
      
      // Ciclo 2: 01/07 - 01/08
      expect(cycles[1].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 6, 1)).toISOString());
      expect(cycles[1].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 1)).toISOString());
      
      // Ciclo 3: 01/08 - 01/09
      expect(cycles[2].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 1)).toISOString());
      expect(cycles[2].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 8, 1)).toISOString());

      // Ciclo 4: 01/09 - 01/10 (Conserva identidad absoluta aunque sobresalga de 30/09)
      expect(cycles[3].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 8, 1)).toISOString());
      expect(cycles[3].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 9, 1)).toISOString());
    });

    it('WEEKLY: Debe generar ciclos cruzando meses correctamente', () => {
      // Season: 27/07/2026 -> 31/08/2026
      const start = new Date(Date.UTC(2026, 6, 27)); // 27 de Julio
      const end = new Date(Date.UTC(2026, 7, 31)); // 31 de Agosto

      const cycles = getAbsoluteSeasonCycles(start, end, 'WEEKLY');

      // Ciclo 1: 27/07 - 03/08
      expect(cycles[0].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 6, 27)).toISOString());
      expect(cycles[0].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 3)).toISOString());
      
      // Ciclo 2: 03/08 - 10/08 (Cruza mes sin retroceder al mes anterior!)
      expect(cycles[1].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 3)).toISOString());
      expect(cycles[1].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 10)).toISOString());
    });

    it('BIWEEKLY: Debe mantener intervalos de 14 días consecutivos', () => {
      const start = new Date(Date.UTC(2026, 6, 27));
      const end = new Date(Date.UTC(2026, 8, 1)); 

      const cycles = getAbsoluteSeasonCycles(start, end, 'BIWEEKLY');

      // Ciclo 1: 27/07 - 10/08
      expect(cycles[0].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 6, 27)).toISOString());
      expect(cycles[0].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 10)).toISOString());
      
      // Ciclo 2: 10/08 - 24/08
      expect(cycles[1].cycleStartDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 10)).toISOString());
      expect(cycles[1].cycleEndDate.toISOString()).toBe(new Date(Date.UTC(2026, 7, 24)).toISOString());
    });

    it('SINGLE: Debe generar exactamente un bloque de toda la Season', () => {
      const start = new Date(Date.UTC(2026, 0, 1));
      const end = new Date(Date.UTC(2026, 11, 31));

      const cycles = getAbsoluteSeasonCycles(start, end, 'SINGLE');

      expect(cycles.length).toBe(1);
      expect(cycles[0].cycleStartDate.toISOString()).toBe(start.toISOString());
      expect(cycles[0].cycleEndDate.toISOString()).toBe(end.toISOString());
    });

    it('Determinismo y Independencia del Estudiante: Dos llamadas idénticas devuelven el mismo resultado', () => {
      const start = new Date(Date.UTC(2026, 5, 1));
      const end = new Date(Date.UTC(2026, 8, 30));

      const cycles1 = getAbsoluteSeasonCycles(start, end, 'MONTHLY');
      const cycles2 = getAbsoluteSeasonCycles(start, end, 'MONTHLY');

      expect(JSON.stringify(cycles1)).toBe(JSON.stringify(cycles2));
      // No se pasa membership ni fechas del alumno a la función.
    });
  });

  describe('Bugfix en calculateCycleDates (simulateAllCycles compatibilidad)', () => {
    it('Debe calcular correctamente la semana cruzando el mes sin retroceder', () => {
      const startDate = new Date(Date.UTC(2026, 6, 27)); // 27 de Julio
      const seasonEndDate = new Date(Date.UTC(2026, 11, 31));

      // Simulamos el ciclo 1
      const cycle1 = calculateCycleDates(startDate, seasonEndDate, 1, 'WEEKLY', 1);
      expect(cycle1.dueDate.toISOString()).toBe(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2026, 6, 27))).toISOString());
      expect(cycle1.nextDueDate.toISOString()).toBe(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2026, 7, 3))).toISOString());

      // Simulamos el ciclo 2 (Aquí ocurría el bug y nextDueDate daba 10 de Julio)
      const cycle2 = calculateCycleDates(startDate, seasonEndDate, 1, 'WEEKLY', 2);
      expect(cycle2.dueDate.toISOString()).toBe(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2026, 7, 3))).toISOString()); // 3 de Agosto
      expect(cycle2.nextDueDate.toISOString()).toBe(DateUtils.getEndOfLocalDayInUTC(new Date(Date.UTC(2026, 7, 10))).toISOString()); // 10 de Agosto (Antes era 10 de Julio)
    });
  });

  describe('FASE 2.4 - Resolución de CycleEnrollment y Pausas', () => {
    describe('findCycleContainingDate', () => {
      const cycles = [
        {
          cycleCounter: 1, cycleStartDate: new Date(Date.UTC(2026, 7, 1)), cycleEndDate: new Date(Date.UTC(2026, 8, 1)),
          billingYear: 2026, billingMonth: 8, billingCycle: 1
        },
        {
          cycleCounter: 2, cycleStartDate: new Date(Date.UTC(2026, 8, 1)), cycleEndDate: new Date(Date.UTC(2026, 9, 1)),
          billingYear: 2026, billingMonth: 9, billingCycle: 2
        }
      ];

      it('Inscripción al inicio exacto del ciclo', () => {
        const date = new Date(Date.UTC(2026, 7, 1));
        const cycle = findCycleContainingDate(cycles, date);
        expect(cycle).toBeDefined();
        expect(cycle?.cycleCounter).toBe(1);
      });

      it('Inscripción a mitad de ciclo MONTHLY', () => {
        const date = new Date(Date.UTC(2026, 7, 15));
        const cycle = findCycleContainingDate(cycles, date);
        expect(cycle?.cycleCounter).toBe(1);
      });

      it('Inscripción exactamente en cycleEndDate debe pertenecer al siguiente ciclo', () => {
        const date = new Date(Date.UTC(2026, 8, 1));
        const cycle = findCycleContainingDate(cycles, date);
        expect(cycle?.cycleCounter).toBe(2);
      });

      it('Retorna null si la fecha no pertenece a ningún ciclo', () => {
        const date = new Date(Date.UTC(2026, 10, 1));
        const cycle = findCycleContainingDate(cycles, date);
        expect(cycle).toBeNull();
      });
    });

    describe('calculateEffectiveBillablePeriod', () => {
      const cycle = {
        cycleCounter: 1,
        cycleStartDate: new Date(Date.UTC(2026, 7, 1)),
        cycleEndDate: new Date(Date.UTC(2026, 8, 1)),
        billingYear: 2026, billingMonth: 8, billingCycle: 1
      };
      const seasonEndDate = new Date(Date.UTC(2026, 11, 31));

      it('Inscripción tardía (mitad de ciclo) desplaza el effectiveStart', () => {
        const enrollment = new Date(Date.UTC(2026, 7, 15));
        const result = calculateEffectiveBillablePeriod(cycle, enrollment, seasonEndDate);
        expect(result.effectiveStart.toISOString()).toBe(enrollment.toISOString());
        expect(result.effectiveEnd.toISOString()).toBe(cycle.cycleEndDate.toISOString());
      });

      it('Season truncada (fin de season antes del fin de ciclo) desplaza el effectiveEnd', () => {
        const enrollment = new Date(Date.UTC(2026, 7, 1));
        const earlyEnd = new Date(Date.UTC(2026, 7, 20)); // Termina antes
        const result = calculateEffectiveBillablePeriod(cycle, enrollment, earlyEnd);
        expect(result.effectiveStart.toISOString()).toBe(cycle.cycleStartDate.toISOString());
        expect(result.effectiveEnd.toISOString()).toBe(earlyEnd.toISOString());
      });
    });

    describe('calculateBillableDaysWithPauses', () => {
      const effectiveStart = new Date(Date.UTC(2026, 7, 1)); // 01/08
      const effectiveEnd = new Date(Date.UTC(2026, 8, 1)); // 01/09 (31 días en agosto)

      it('Sin pausas: cobra todos los días', () => {
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, []);
        expect(res.totalDays).toBe(31);
        expect(res.pauseDays).toBe(0);
        expect(res.billableDays).toBe(31);
      });

      it('Pausa completamente dentro del ciclo', () => {
        const pauses = [
          { startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 15)) } // 5 días
        ];
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, pauses);
        expect(res.pauseDays).toBe(5);
        expect(res.billableDays).toBe(26);
      });

      it('Pausa que empieza antes del ciclo (solo descuenta la intersección)', () => {
        const pauses = [
          { startDate: new Date(Date.UTC(2026, 6, 25)), endDate: new Date(Date.UTC(2026, 7, 5)) } // Cruza el inicio (01/08)
        ];
        // Intersección: 01/08 -> 05/08 = 4 días
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, pauses);
        expect(res.pauseDays).toBe(4);
        expect(res.billableDays).toBe(27);
      });

      it('Pausa que termina después del ciclo (solo descuenta la intersección)', () => {
        const pauses = [
          { startDate: new Date(Date.UTC(2026, 7, 25)), endDate: new Date(Date.UTC(2026, 8, 5)) } // Cruza el fin (01/09)
        ];
        // Intersección: 25/08 -> 01/09 = 7 días
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, pauses);
        expect(res.pauseDays).toBe(7);
        expect(res.billableDays).toBe(24);
      });

      it('Múltiples pausas sin solapamiento', () => {
        const pauses = [
          { startDate: new Date(Date.UTC(2026, 7, 5)), endDate: new Date(Date.UTC(2026, 7, 10)) }, // 5 días
          { startDate: new Date(Date.UTC(2026, 7, 15)), endDate: new Date(Date.UTC(2026, 7, 18)) } // 3 días
        ];
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, pauses);
        expect(res.pauseDays).toBe(8);
        expect(res.billableDays).toBe(23);
      });

      it('Múltiples pausas solapadas (hace merge y no descuenta doble)', () => {
        const pauses = [
          { startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 15)) }, // 10/08 -> 15/08
          { startDate: new Date(Date.UTC(2026, 7, 12)), endDate: new Date(Date.UTC(2026, 7, 20)) }  // 12/08 -> 20/08
        ];
        // Merge: 10/08 -> 20/08 = 10 días
        const res = calculateBillableDaysWithPauses(effectiveStart, effectiveEnd, pauses);
        expect(res.pauseDays).toBe(10);
        expect(res.billableDays).toBe(21);
      });
    });
  });

  describe('calculateCycleFeeFactor (Regla 50% mitad del ciclo)', () => {
    const cycleStart = new Date(Date.UTC(2026, 8, 1)); // 01-Sep
    const cycleEnd = new Date(Date.UTC(2026, 9, 1)); // 01-Oct
    // Midpoint: 2026-09-16T00:00:00.000Z

    it('Caso A: enrollmentDate < cycleStartDate -> 100%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 7, 20));
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate)).toBe(1.0);
    });

    it('Caso B: enrollmentDate === cycleStartDate -> 100%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 8, 1));
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate)).toBe(1.0);
    });

    it('Caso C: enrollmentDate < midpoint -> 100%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 8, 10)); // 10-Sep
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate)).toBe(1.0);
    });

    it('Caso D: enrollmentDate === midpoint -> 100%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 8, 16)); // 16-Sep 00:00:00
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate)).toBe(1.0);
    });

    it('Caso E: enrollmentDate > midpoint -> 50%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 8, 17)); // 17-Sep
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate)).toBe(0.5);
    });

    it('Caso F: enrollmentDate > midpoint pero forceFullCycleFee = true -> 100%', () => {
      const enrollmentDate = new Date(Date.UTC(2026, 8, 17));
      expect(calculateCycleFeeFactor(cycleStart, cycleEnd, enrollmentDate, true)).toBe(1.0);
    });

    it('Caso I/J/K: Funciona matemáticamente para ciclo semanal (WEEKLY)', () => {
      const weeklyStart = new Date(Date.UTC(2026, 8, 1)); // 01-Sep
      const weeklyEnd = new Date(Date.UTC(2026, 8, 8)); // 08-Sep
      // Midpoint: 4.5 días (04-Sep 12:00:00 o 05-Sep 00:00:00 dependiendo)
      // 1 + 7/2 = 4.5 -> 04-Sep 12:00:00
      
      const antes = new Date(Date.UTC(2026, 8, 3));
      const despues = new Date(Date.UTC(2026, 8, 6));

      expect(calculateCycleFeeFactor(weeklyStart, weeklyEnd, antes)).toBe(1.0);
      expect(calculateCycleFeeFactor(weeklyStart, weeklyEnd, despues)).toBe(0.5);
    });
  });
});
