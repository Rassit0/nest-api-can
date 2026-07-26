import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StudentLateFeeService } from './student-late-fee.service';

@Injectable()
export class StudentLateFeeCron {
  private readonly logger = new Logger(StudentLateFeeCron.name);

  constructor(private readonly lateFeeService: StudentLateFeeService) {}

  // Se ejecutará todos los días a la 1:30 AM
  @Cron('30 1 * * *')
  async handleDailyLateFees() {
    this.logger.log(
      'Iniciando tarea programada: Generación de mora de Estudiantes...',
    );
    await this.lateFeeService.applyDailyLateFees();
  }
}
