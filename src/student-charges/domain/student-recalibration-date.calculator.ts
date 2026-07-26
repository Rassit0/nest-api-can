import { Injectable } from '@nestjs/common';

@Injectable()
export class StudentRecalibrationDateCalculator {
  /**
   * Calcula la fecha óptima a la que debe retroceder el puntero de generación de cargos
   * (nextRecurringChargeGenerationDate) basándose en los cargos pendientes existentes
   * y las reglas de facturación de la temporada.
   *
   * Esta es una regla de dominio pura (sin dependencias a persistencia).
   *
   * @param recurringCharges Cargos recurrentes pendientes
   * @param currentNextDate Fecha actual del puntero
   * @param chargeGenerationDaysBefore Regla de facturación (cuántos días antes se factura)
   */
  calculateRecalibrationDate(
    recurringCharges: { charge: { dueDate: Date } }[],
    currentNextDate: Date | null,
    chargeGenerationDaysBefore: number,
  ): Date | null {
    if (recurringCharges.length === 0) return currentNextDate;

    // Encontrar la fecha de vencimiento más antigua entre los cargos que van a eliminarse
    const earliestDueDate = new Date(
      Math.min(...recurringCharges.map((mc) => mc.charge.dueDate.getTime())),
    );

    // Retroceder el reloj según la configuración de la temporada
    const calculatedResetDate = new Date(earliestDueDate);
    calculatedResetDate.setUTCDate(
      calculatedResetDate.getUTCDate() - chargeGenerationDaysBefore,
    );

    // Solo retrocedemos el puntero si la nueva fecha calculada es anterior a la actual
    if (!currentNextDate || calculatedResetDate < currentNextDate) {
      return calculatedResetDate;
    }

    return currentNextDate;
  }
}
