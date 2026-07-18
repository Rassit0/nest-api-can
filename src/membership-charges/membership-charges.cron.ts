import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MembershipChargesService } from './membership-charges.service';

@Injectable()
export class MembershipChargesCron {
  private readonly logger = new Logger(MembershipChargesCron.name);

  constructor(private readonly chargesService: MembershipChargesService) {}

  // Se ejecutará todos los días a la 1:00 AM
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyCharges() {
    this.logger.log(
      'Iniciando tarea programada: Generación de cargos de Club...',
    );
    await this.chargesService.applyDailyMembershipCharges();
  }
}
