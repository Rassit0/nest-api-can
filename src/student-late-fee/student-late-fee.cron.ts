import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StudentLateFeeService } from './student-late-fee.service';
import { envs } from '../config/envs';

@Injectable()
export class StudentLateFeeCron {
  private readonly logger = new Logger(StudentLateFeeCron.name);

  constructor(private readonly lateFeeService: StudentLateFeeService) {}

  // Se ejecutará todos los días a la 2:30 AM
  @Cron('30 2 * * *', {
    timeZone: envs.appTimezone,
  })
  async handleDailyLateFees() {
    this.logger.log(
      'Iniciando tarea programada: Generación de mora de Estudiantes...',
    );
    await this.lateFeeService.applyDailyLateFees();
  }
}
