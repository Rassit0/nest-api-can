import { Controller, Get } from '@nestjs/common';
import { FinancialAccountsService } from './financial-accounts.service';

@Controller('financial-accounts')
export class FinancialAccountsController {
  constructor(private readonly financialAccountsService: FinancialAccountsService) {}

  @Get()
  async findAll() {
    const data = await this.financialAccountsService.findAll();
    return {
      message: 'Cuentas financieras obtenidas exitosamente',
      data,
    };
  }
}
