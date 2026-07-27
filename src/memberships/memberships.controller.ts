import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { MembershipsService } from './memberships.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';

@ApiTags('Memberships')
@Controller('memberships')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get('summary')
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS') // Adjust based on your permissions structure
  @ApiOperation({
    summary: 'Obtener resumen general de membresías',
    description:
      'Retorna un objeto estructurado con indicadores y tablas para construir el Dashboard de Membresías.',
  })
  @ApiOkResponse({
    description: 'Resumen de membresías obtenido exitosamente.',
  })
  async getDashboardSummary() {
    return this.membershipsService.getDashboardSummary();
  }
}
