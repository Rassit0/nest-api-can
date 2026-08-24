import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { StudentRegularizationService } from './services/student-regularization.service';
import { StudentReactivationService } from './services/student-reactivation.service';
import { RegularizeStudentChargeDto } from './dto/regularize-student-charge.dto';
import { ReactivateStudentMembershipDto } from './dto/reactivate-student-membership.dto';
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateMassiveManualChargeDto } from './dto/create-massive-manual-charge.dto';
import { PreviewAdvanceChargesDto } from './dto/preview-advance-charges.dto';
import { PurchaseAdvanceCyclesDto } from './dto/purchase-advance-cycles.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Membership Charges')
@Controller('student-charges')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class StudentChargesController {
  constructor(
    private readonly studentChargesService: StudentChargesService,
    private readonly studentRegularizationService: StudentRegularizationService,
    private readonly studentReactivationService: StudentReactivationService,
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
  @RequirePermissions('CREATE_STUDENT_CHARGES')
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
  @RequirePermissions('READ_STUDENT_CHARGES')
  async previewExistingCharges(@Param('membershipId') membershipId: string) {
    const charges =
      await this.studentChargesService.previewExistingCharges(membershipId);

    return {
      message: 'Previsualización de cargos faltantes generada correctamente.',
      data: charges,
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
  @RequirePermissions('CREATE_STUDENT_CHARGES')
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
  @RequirePermissions('CREATE_STUDENT_CHARGES')
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
  @ApiResponse({
    status: 200,
    description: 'Previsualización de cuotas adelantadas generada.',
  })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async previewAdvanceCharges(
    @Param('membershipId') membershipId: string,
    @Body() dto: PreviewAdvanceChargesDto,
  ) {
    const data = await this.studentChargesService.previewAdvanceCharges(
      membershipId,
      dto.quantity,
    );
    return {
      message: 'Previsualización de cuotas adelantadas obtenida',
      data,
    };
  }

  @Post('advance/:membershipId/purchase')
  @ApiOperation({
    summary: 'Comprar ciclos adelantados',
    description:
      'Inscribe y registra en la base de datos la compra adelantada de los próximos N ciclos para una membresía específica.',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía' })
  @ApiBody({ type: PurchaseAdvanceCyclesDto })
  @ApiResponse({
    status: 201,
    description: 'Compra de ciclos adelantados exitosa.',
  })
  @ApiResponse({ status: 404, description: 'Membresía no encontrada.' })
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async purchaseAdvanceCycles(
    @Param('membershipId') membershipId: string,
    @Body() dto: PurchaseAdvanceCyclesDto,
  ) {
    const data = await this.studentChargesService.purchaseAdvanceCycles(
      membershipId,
      dto.quantity,
    );
    return {
      message: data.message,
      data,
    };
  }

  @Post(':membershipId/reactivation')
  @ApiOperation({
    summary: 'Reactivar membresía con nuevos ciclos',
    description:
      'Reactiva un estudiante SUSPENDIDO inscribiéndolo en los próximos N ciclos a partir de su fecha de reingreso (reentryDate).',
  })
  @ApiParam({ name: 'membershipId', description: 'ID de la membresía suspendida' })
  @ApiBody({ type: ReactivateStudentMembershipDto })
  @ApiResponse({
    status: 201,
    description: 'Reactivación exitosa con inscripción a ciclos.',
  })
  @ApiResponse({ status: 400, description: 'La membresía no está suspendida o la fecha es inválida.' })
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async reactivateWithCycles(
    @Param('membershipId') membershipId: string,
    @Body() dto: ReactivateStudentMembershipDto,
  ) {
    const data = await this.studentReactivationService.reactivateWithCycles(
      membershipId,
      dto,
    );
    return {
      message: data.message,
      data: data.membership,
    };
  }

  @Get(':membershipId/regularizable-cycles')
  @RequirePermissions('READ_STUDENT_CHARGES')
  async getRegularizableCycles(@Param('membershipId') membershipId: string) {
    return this.studentRegularizationService.getRegularizableCycles(membershipId);
  }

  @Post(':membershipId/regularize')
  @RequirePermissions('CREATE_STUDENT_CHARGES')
  async regularizeCharge(
    @Param('membershipId') membershipId: string,
    @Body() dto: RegularizeStudentChargeDto,
    @Req() req: Request & { user: any },
  ) {
    if (dto.overrideAmount !== undefined && dto.overrideAmount !== null) {
      if (!req.user.permissions?.includes('OVERRIDE_STUDENT_CHARGES')) {
        throw new ForbiddenException('No posees permisos para sobreescribir montos históricos.');
      }
    }
    return this.studentRegularizationService.regularizeCharge(membershipId, dto);
  }

}
