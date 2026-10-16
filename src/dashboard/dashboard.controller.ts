import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiStandardResponse } from 'src/common/decorators/api-responses.decorator';
import { DashboardService } from './dashboard.service';
import {
  DashboardSummaryQueryDto,
  DashboardActivityQueryDto,
} from './dto/dashboard-query.dto';
import { DashboardSummaryResponseDto } from './dto/dashboard-summary.dto';
import { DashboardActivityResponseDto } from './dto/dashboard-activity.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Obtener resumen ejecutivo del Super Dashboard',
    description:
      'Retorna métricas de liquidez, flujo financiero, cuentas por cobrar, comunidad y ocupación de turnos adaptadas a los permisos del usuario autenticado.',
  })
  @ApiStandardResponse(
    DashboardSummaryResponseDto,
    'Resumen del Dashboard obtenido correctamente.',
  )
  async getSummary(
    @Query() query: DashboardSummaryQueryDto,
    @Req() req: any,
  ): Promise<DashboardSummaryResponseDto> {
    const userPermissions: string[] = req.user?.permissions || [];
    return await this.dashboardService.getSummary(query, userPermissions);
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Obtener feed de actividad reciente del sistema',
    description:
      'Retorna un listado higienizado de eventos y transacciones recientes mapeadas al dominio de negocio.',
  })
  @ApiStandardResponse(
    DashboardActivityResponseDto,
    'Actividad reciente obtenida correctamente.',
  )
  @RequirePermissions('READ_AUDIT_LOGS')
  async getActivity(
    @Query() query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityResponseDto> {
    return await this.dashboardService.getActivity(query);
  }
}
