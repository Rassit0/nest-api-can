import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { envs } from '../config/envs';

@Injectable()
export class MembershipLateFeeCron {
  private readonly logger = new Logger(MembershipLateFeeCron.name);

  constructor(private readonly lateFeeService: MembershipLateFeeService) {}

  // Se ejecutará todos los días a las 2:00 AM (después de la generación de cargos)
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    timeZone: envs.appTimezone,
  })
  async handleDailyLateFees() {
    this.logger.log(
      'Iniciando tarea programada: Generación de recargos (Club)...',
    );
    await this.lateFeeService.applyDailyLateFees();
  }
}
