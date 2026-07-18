import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StudentLateFeeService } from './student-late-fee.service';

@Injectable()
export class StudentLateFeeCron {
  private readonly logger = new Logger(StudentLateFeeCron.name);

  constructor(private readonly lateFeeService: StudentLateFeeService) {}

  // Se ejecutará todos los días a las 2:00 AM (después de la generación de cargos)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyLateFees() {
    this.logger.log(
      'Iniciando tarea programada: Generación de recargos (Escuela)...',
    );
    await this.lateFeeService.applyDailyLateFees();
  }
}
