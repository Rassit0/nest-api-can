import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StudentChargesService } from './student-charges.service';

@Injectable()
export class StudentChargesCron {
  private readonly logger = new Logger(StudentChargesCron.name);

  constructor(private readonly chargesService: StudentChargesService) {}

  // Se ejecutará todos los días a la 1:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyCharges() {
    this.logger.log(
      'Iniciando tarea programada: Generación de cargos de Escuela...',
    );
    await this.chargesService.applyDailyStudentCharges();
  }
}
