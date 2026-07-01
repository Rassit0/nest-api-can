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
  @ApiOkResponse({
    description: 'Cargos y mora calculados y aplicados correctamente.',
  })
  async applyCharges() {
    await this.studentChargesService.applyDailyStudentCharges();
    await this.studentLateFeeService.applyDailyLateFees();

    return {
      message:
        'Proceso de cobros y recargos escolares ejecutado correctamente.',
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar un cargo a un estudiante manualmente',
    description:
      'Crea un mapeo de cargo a una inscripción escolar específica (ej: inscripción, mensualidad o recargo manual).',
  })
  @ApiCreatedResponse({ description: 'Cargo escolar registrado con éxito.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createStudentChargeDto: CreateStudentChargeDto) {
    return await this.studentChargesService.createStudentCharge(
      createStudentChargeDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de cargos de estudiantes',
    description:
      'Retorna una lista paginada y filtrable de todos los cargos de estudiantes registrados.',
  })
  @ApiOkResponse({ description: 'Lista de cargos obtenida correctamente.' })
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
  @ApiOkResponse({ description: 'Cargo escolar encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
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
  @ApiOkResponse({
    description: 'Cargo de estudiante actualizado exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
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
  @ApiOkResponse({ description: 'Cargo escolar eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El cargo solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentChargesService.remove(id);
  }
}
