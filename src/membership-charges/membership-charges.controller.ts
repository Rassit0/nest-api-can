import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MembershipChargesService } from './membership-charges.service';
import { CreateMembershipChargeDto } from './dto/create-membership-charge.dto';
import { UpdateMembershipChargeDto } from './dto/update-membership-charge.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { MembershipChargeResponseDto } from '../common/dto/responses/entities.dto';
import { PreviewMembershipChargesDto } from './dto/preview-membership-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateMassiveManualChargeDto } from './dto/create-massive-manual-charge.dto';
import { PreviewAdvanceChargesDto } from './dto/preview-advance-charges.dto';
import { GenerateAdvanceChargesDto } from './dto/generate-advance-charges.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Membership Charges')
@Controller('membership-charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class MembershipChargesController {
  constructor(
    private readonly membershipChargesService: MembershipChargesService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Previsualizar cargos de membresía',
    description:
      'Calcula y previsualiza los cargos que se generarían para una membresía dada antes de ser creada, incluyendo cobros únicos o mensuales.',
  })
  @ApiBody({ type: PreviewMembershipChargesDto })
  @ApiResponse({
    status: 201,
    description: 'Previsualización generada correctamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (por ejemplo, fecha de inicio fuera de temporada).',
  })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async previewCharges(@Body() previewData: PreviewMembershipChargesDto) {
    const charges =
      await this.membershipChargesService.previewCharges(previewData);

    return {
      message: 'Previsualización de cargos generada correctamente.',
      data: charges,
    };
  }

  @Get('preview/:membershipId')
  @ApiOperation({
    summary: 'Previsualizar cargos pendientes de una membresía',
    description:
      'Genera la simulación de los próximos pagos pendientes para una membresía ya existente, útil para pagos únicos atrasados o cuotas mensuales futuras.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiResponse({
    status: 200,
    description: 'Previsualización de cargos faltantes generada.',
  })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  @RequirePermissions('READ_MEMBERSHIP_CHARGES')
  async previewExistingCharges(@Param('membershipId') membershipId: string) {
    const charges =
      await this.membershipChargesService.previewExistingCharges(membershipId);

    return {
      message: 'Previsualización de cargos faltantes generada correctamente.',
      data: charges,
    };
  }

  @Post('apply')
  @ApiOperation({
    summary: 'Generar cargos mensuales masivamente',
    description:
      'Inicia el proceso (típicamente programado por Cron) para calcular y generar las cuotas mensuales para todas las membresías activas que les toque cobro.',
  })
  @ApiResponse({ status: 201, description: 'Proceso ejecutado.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async applyCharges() {
    await this.membershipChargesService.applyDailyMembershipCharges();

    return {
      message: 'Proceso de generación de cargos ejecutado correctamente.',
    };
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Generar un cargo manual',
    description:
      'Crea un cargo manual adicional para una membresía existente (por ejemplo: equipamiento extra, multas, etc).',
  })
  @ApiBody({ type: CreateManualChargeDto })
  @ApiResponse({
    status: 201,
    description: 'Cargo manual creado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Membresía no encontrada o datos inválidos.',
  })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async createManualCharge(@Body() dto: CreateManualChargeDto) {
    return await this.membershipChargesService.createManualCharge(dto);
  }

  @Post('massive-manual')
  @ApiOperation({
    summary: 'Generar un cargo manual masivo',
    description:
      'Crea un cargo manual para todos los miembros ACTIVOS o PENDIENTES de una temporada (ej. inscripciones a torneos).',
  })
  @ApiBody({ type: CreateMassiveManualChargeDto })
  @ApiResponse({ status: 201, description: 'Cargos generados exitosamente.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async createMassiveManualCharge(@Body() dto: CreateMassiveManualChargeDto) {
    return await this.membershipChargesService.createMassiveManualCharge(dto);
  }

  @Post('advance/:membershipId/preview')
  @ApiOperation({
    summary: 'Previsualizar cuotas adelantadas',
    description:
      'Previsualiza las próximas N cuotas que se pueden generar por adelantado para una membresía específica.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiBody({ type: PreviewAdvanceChargesDto })
  @ApiResponse({
    status: 200,
    description: 'Previsualización de cuotas adelantadas generada.',
  })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async previewAdvanceCharges(
    @Param('membershipId') membershipId: string,
    @Body() dto: PreviewAdvanceChargesDto,
  ) {
    const data = await this.membershipChargesService.previewAdvanceCharges(
      membershipId,
      dto.quantity,
    );
    return {
      message: 'Previsualización de cuotas adelantadas obtenida',
      data,
    };
  }

  @Post('advance/:membershipId/generate')
  @ApiOperation({
    summary: 'Generar cuotas adelantadas',
    description:
      'Genera y registra en la base de datos las próximas N cuotas adelantadas para una membresía específica.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiBody({ type: GenerateAdvanceChargesDto })
  @ApiResponse({
    status: 201,
    description: 'Cuotas adelantadas generadas exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  @RequirePermissions('CREATE_MEMBERSHIP_CHARGES')
  async generateAdvanceCharges(
    @Param('membershipId') membershipId: string,
    @Body() dto: GenerateAdvanceChargesDto,
  ) {
    const data = await this.membershipChargesService.generateAdvanceCharges(
      membershipId,
      dto.quantity,
    );
    return {
      message: data.message,
      data,
    };
  }
}
