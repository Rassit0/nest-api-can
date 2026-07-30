import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AccountingDashboardService } from './accounting-dashboard.service';
import { ApiStandardResponse } from 'src/common/decorators/api-responses.decorator';

@ApiTags('Accounting Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('accounting-dashboard')
export class AccountingDashboardController {
  constructor(private readonly dashboardService: AccountingDashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen del dashboard contable', description: 'Devuelve un resumen consolidado de cuentas por cobrar, cuentas por pagar y flujo de caja general.' })
  @ApiStandardResponse(Object, 'Resumen contable obtenido exitosamente.')
  @RequirePermissions('READ_ACCOUNT_CHARGES') // Reutilizamos el permiso por ahora, o crearíamos uno nuevo
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
