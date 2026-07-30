import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountingDashboardService } from './accounting-dashboard.service';

@ApiTags('Accounting Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('accounting-dashboard')
export class AccountingDashboardController {
  constructor(private readonly dashboardService: AccountingDashboardService) {}

  @Get('summary')
  @RequirePermissions('READ_ACCOUNT_CHARGES') // Reutilizamos el permiso por ahora, o crearíamos uno nuevo
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
