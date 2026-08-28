import { Controller, Post, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { MembershipLateFeeService } from './membership-late-fee.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Membership Charges (Late Fees)')
@Controller('membership-charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class MembershipLateFeeController {
  constructor(private readonly membershipLateFeeService: MembershipLateFeeService) {}

  @Post(':id/late-fee/preview')
  @ApiOperation({
    summary: 'Previsualizar recargo por mora (Club)',
    description: 'Calcula y previsualiza la mora correspondiente a un cargo vencido de membresía de equipo.',
  })
  @ApiParam({ name: 'id', description: 'ID del cargo base' })
  @ApiResponse({ status: 200, description: 'Previsualización generada correctamente.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async previewLateFee(@Param('id', ParseUUIDPipe) chargeId: string) {
    const preview = await this.membershipLateFeeService.previewLateFee(chargeId);
    return {
      message: 'Previsualización de recargo generada',
      data: preview,
    };
  }

  @Post(':id/late-fee/apply')
  @ApiOperation({
    summary: 'Aplicar recargo por mora (Club)',
    description: 'Calcula y aplica la mora sobre un cargo vencido creando un nuevo cargo de tipo LATE_FEE.',
  })
  @ApiParam({ name: 'id', description: 'ID del cargo base' })
  @ApiResponse({ status: 201, description: 'Recargo aplicado exitosamente.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async applyLateFee(@Param('id', ParseUUIDPipe) chargeId: string) {
    return await this.membershipLateFeeService.applyLateFee(chargeId);
  }
}
