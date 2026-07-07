import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { CreateMembershipChargeDto } from './dto/create-membership-charge.dto';
import { UpdateMembershipChargeDto } from './dto/update-membership-charge.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { MembershipChargeResponseDto } from '../common/dto/responses/entities.dto';
import { PreviewMembershipChargesDto } from './dto/preview-membership-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Membership Charges')
@Controller('membership-charges')
export class MembershipChargesController {
  constructor(
    private readonly membershipChargesService: MembershipChargesService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Previsualizar cargos de membresía',
    description: 'Calcula y previsualiza los cargos que se generarían para una membresía dada antes de ser creada, incluyendo cobros únicos o mensuales.',
  })
  @ApiBody({ type: PreviewMembershipChargesDto })
  @ApiResponse({ status: 201, description: 'Previsualización generada correctamente.' })
  @ApiResponse({ status: 400, description: 'Error de validación (por ejemplo, fecha de inicio fuera de temporada).' })
  async previewCharges(@Body() previewData: PreviewMembershipChargesDto) {
    const charges = await this.membershipChargesService.previewCharges(previewData);
    
    return {
      message: 'Previsualización de cargos generada correctamente.',
      data: charges,
    };
  }

  @Get('preview/:membershipId')
  @ApiOperation({
    summary: 'Previsualizar cargos pendientes de una membresía',
    description: 'Genera la simulación de los próximos pagos pendientes para una membresía ya existente, útil para pagos únicos atrasados o cuotas mensuales futuras.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiResponse({ status: 200, description: 'Previsualización de cargos faltantes generada.' })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  async previewExistingCharges(@Param('membershipId') membershipId: string) {
    const charges = await this.membershipChargesService.previewExistingCharges(membershipId);
    
    return {
      message: 'Previsualización de cargos faltantes generada correctamente.',
      data: charges,
    };
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Generar cargos mensuales masivamente',
    description: 'Inicia el proceso (típicamente programado por Cron) para calcular y generar las cuotas mensuales para todas las membresías activas que les toque cobro.',
  })
  @ApiResponse({ status: 201, description: 'Proceso ejecutado.' })
  async applyCharges() {
    await this.membershipChargesService.applyDailyMembershipCharges();

    return {
      message: 'Proceso de generación de cargos ejecutado correctamente.',
    };
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Generar un cargo manual',
    description: 'Crea un cargo manual adicional para una membresía existente (por ejemplo: equipamiento extra, multas, etc).',
  })
  @ApiBody({ type: CreateManualChargeDto })
  @ApiResponse({ status: 201, description: 'Cargo manual creado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Membresía no encontrada o datos inválidos.' })
  async createManualCharge(@Body() dto: CreateManualChargeDto) {
    return await this.membershipChargesService.createManualCharge(dto);
  }
}
