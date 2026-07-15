import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { StudentChargesService } from './student-charges.service';
import { CreateStudentChargeDto } from './dto/create-student-charge.dto';
import { UpdateStudentChargeDto } from './dto/update-student-charge.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { StudentChargeResponseDto } from '../common/dto/responses/entities.dto';
import { PreviewStudentChargesDto } from './dto/preview-student-charges.dto';
import { CreateManualChargeDto } from './dto/create-manual-charge.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CreateMassiveManualChargeDto } from './dto/create-massive-manual-charge.dto';
import { PreviewAdvanceChargesDto } from './dto/preview-advance-charges.dto';
import { GenerateAdvanceChargesDto } from './dto/generate-advance-charges.dto';

@ApiTags('Membership Charges')
@Controller('student-charges')
export class StudentChargesController {
  constructor(
    private readonly studentChargesService: StudentChargesService,
  ) {}

  @Post('preview')
  @ApiOperation({
    summary: 'Previsualizar cargos de membresía',
    description:
      'Calcula y previsualiza los cargos que se generarían para una membresía dada antes de ser creada, incluyendo cobros únicos o mensuales.',
  })
  @ApiBody({ type: PreviewStudentChargesDto })
  @ApiResponse({
    status: 201,
    description: 'Previsualización generada correctamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (por ejemplo, fecha de inicio fuera de temporada).',
  })
  async previewCharges(@Body() previewData: PreviewStudentChargesDto) {
    const charges =
      await this.studentChargesService.previewCharges(previewData);

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
  async previewExistingCharges(@Param('membershipId') membershipId: string) {
    const charges =
      await this.studentChargesService.previewExistingCharges(membershipId);

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
  async applyCharges() {
    await this.studentChargesService.applyDailyStudentCharges();

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
  async createManualCharge(@Body() dto: CreateManualChargeDto) {
    return await this.studentChargesService.createManualCharge(dto);
  }

  @Post('massive-manual')
  @ApiOperation({
    summary: 'Generar un cargo manual masivo',
    description:
      'Crea un cargo manual para todos los miembros ACTIVOS o PENDIENTES de una temporada (ej. inscripciones a torneos).',
  })
  @ApiBody({ type: CreateMassiveManualChargeDto })
  @ApiResponse({ status: 201, description: 'Cargos generados exitosamente.' })
  async createMassiveManualCharge(@Body() dto: CreateMassiveManualChargeDto) {
    return await this.studentChargesService.createMassiveManualCharge(dto);
  }

  @Post('advance/:membershipId/preview')
  @ApiOperation({
    summary: 'Previsualizar cuotas adelantadas',
    description:
      'Previsualiza las próximas N cuotas que se pueden generar por adelantado para una membresía específica.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiBody({ type: PreviewAdvanceChargesDto })
  @ApiResponse({ status: 200, description: 'Previsualización de cuotas adelantadas generada.' })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  async previewAdvanceCharges(
    @Param('membershipId') membershipId: string,
    @Body() dto: PreviewAdvanceChargesDto,
  ) {
    return await this.studentChargesService.previewAdvanceCharges(
      membershipId,
      dto.quantity,
    );
  }

  @Post('advance/:membershipId')
  @ApiOperation({
    summary: 'Generar cuotas adelantadas',
    description:
      'Genera y registra en la base de datos las próximas N cuotas adelantadas para una membresía específica.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiBody({ type: GenerateAdvanceChargesDto })
  @ApiResponse({ status: 201, description: 'Cuotas adelantadas generadas exitosamente.' })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  async generateAdvanceCharges(
    @Param('membershipId') membershipId: string,
    @Body() dto: GenerateAdvanceChargesDto,
  ) {
    return await this.studentChargesService.generateAdvanceCharges(
      membershipId,
      dto.quantity,
    );
  }
}
