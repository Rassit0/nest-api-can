import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { PaymentPlansService } from './payment-plans.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { UpdatePaymentPlanDto } from './dto/update-payment-plan.dto';
import { PaymentPlansPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { PaymentPlanResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Payment Plans')
@Controller('payment-plans')
export class PaymentPlansController {
  constructor(private readonly paymentPlansService: PaymentPlansService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un plan de pago',
    description:
      'Registra un plan de pago para equipos o cursos (cuotas, recargos, días de gracia).',
  })
  @ApiStandardCreatedResponse(PaymentPlanResponseDto, 'Plan de pago creado exitosamente.')
  async create(@Body() createPaymentPlanDto: CreatePaymentPlanDto) {
    return await this.paymentPlansService.create(createPaymentPlanDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar planes de pago',
    description:
      'Retorna una lista paginada y filtrable de todos los planes de pago.',
  })
  @ApiPaginatedResponse(PaymentPlanResponseDto, 'Lista de planes obtenida correctamente.')
  async findAll(@Query() paginationDto: PaymentPlansPaginationDto) {
    return await this.paymentPlansService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener plan de pago por ID',
    description:
      'Retorna la configuración completa del plan de pago por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de pago (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PaymentPlanResponseDto, 'Plan de pago encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentPlansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar plan de pago por ID',
    description:
      'Modifica detalles de cuotas o mora del plan de pago por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de pago a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdatePaymentPlanDto })
  @ApiStandardResponse(PaymentPlanResponseDto, 'Plan de pago actualizado con éxito.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentPlanDto: UpdatePaymentPlanDto,
  ) {
    return await this.paymentPlansService.update(id, updatePaymentPlanDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar plan de pago por ID',
    description: 'Remueve permanentemente un plan de pago del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de pago a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PaymentPlanResponseDto, 'Plan de pago eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.paymentPlansService.remove(id);
  }
}
