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
import { StudentChargesService } from './student-charges.service';
import { StudentLateFeeService } from './student-late-fee.service';
import { CreateStudentChargeDto } from './dto/create-student-charge.dto';
import { UpdateStudentChargeDto } from './dto/update-student-charge.dto';
import { StudentChargesPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { StudentChargeResponseDto } from '../common/dto/responses/entities.dto';
import { CreateManualChargeDto } from '../membership-charges/dto/create-manual-charge.dto';

@ApiTags('Student Charges')
@Controller('student-charges')
export class StudentChargesController {
  constructor(
    private readonly studentChargesService: StudentChargesService,
    private readonly studentLateFeeService: StudentLateFeeService,
  ) {}

  @Post('apply')
  @ApiOperation({
    summary: 'Generar cargos y calcular mora comercial diaria de estudiantes',
    description:
      'Ejecuta de forma manual o programada el cron de facturación de mensualidades y cálculo de mora acumulativa para todos los alumnos del club.',
  })
  @ApiPaginatedResponse(StudentChargeResponseDto, 'Cargos y mora calculados y aplicados correctamente.')
  async findAll(@Query() paginationDto: StudentChargesPaginationDto) {
    return await this.studentChargesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un cargo escolar por ID',
    description:
      'Retorna la información y estado de pago de un cargo de estudiante por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a consultar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(StudentChargeResponseDto, 'Cargo escolar encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentChargesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar detalles de un cargo de estudiante',
    description: 'Actualiza el periodo o tipo de cargo escolar por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStudentChargeDto })
  @ApiStandardResponse(StudentChargeResponseDto, 'Cargo de estudiante actualizado exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentChargeDto: UpdateStudentChargeDto,
  ) {
    return await this.studentChargesService.update(id, updateStudentChargeDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un cargo escolar',
    description:
      'Elimina de manera permanente la relación del cargo con el estudiante.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del cargo a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(StudentChargeResponseDto, 'Cargo escolar eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentChargesService.remove(id);
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Generar un cargo manual',
    description: 'Crea un cargo manual adicional para una inscripción escolar existente (por ejemplo: equipamiento extra, multas, etc).',
  })
  @ApiBody({ type: CreateManualChargeDto })
  @ApiCreatedResponse({ description: 'Cargo manual creado exitosamente para el estudiante.' })
  @ApiBadRequestResponse({ description: 'Membresía no encontrada o datos inválidos.' })
  async createManualCharge(@Body() dto: CreateManualChargeDto) {
    return await this.studentChargesService.createManualCharge(dto);
  }
}
