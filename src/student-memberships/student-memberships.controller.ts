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
import { StudentMembershipsService } from './student-memberships.service';
import { CreateStudentMembershipDto } from './dto/create-student-membership.dto';
import { UpdateStudentMembershipDto } from './dto/update-student-membership.dto';
import { StudentMembershipsPaginationDto } from './dto/pagination.dto';

@ApiTags('Student Memberships')
@Controller('student-memberships')
export class StudentMembershipsController {
  constructor(
    private readonly studentMembershipsService: StudentMembershipsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Inscribir un estudiante a un curso escolar',
    description:
      'Inscribe a un estudiante activo en un curso y periodo específico. Valida de forma estricta los cupos, edad y género.',
  })
  @ApiCreatedResponse({ description: 'Estudiante inscrito exitosamente.' })
  @ApiBadRequestResponse({
    description:
      'El estudiante no es elegible, el curso está lleno, o ya se encuentra inscrito.',
  })
  async create(@Body() createStudentMembershipDto: CreateStudentMembershipDto) {
    return await this.studentMembershipsService.create(
      createStudentMembershipDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de inscripciones escolares',
    description:
      'Retorna una lista paginada y filtrable de todas las inscripciones (membresías escolares).',
  })
  @ApiOkResponse({
    description: 'Lista de inscripciones obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: StudentMembershipsPaginationDto) {
    return await this.studentMembershipsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una inscripción escolar por ID',
    description:
      'Busca y retorna el expediente completo de una inscripción por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Inscripción escolar encontrada exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'La inscripción solicitada no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentMembershipsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una inscripción escolar',
    description:
      'Modifica parámetros generales de la membresía (plan de pago, fecha de inicio) por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStudentMembershipDto })
  @ApiOkResponse({
    description: 'Inscripción escolar actualizada exitosamente.',
  })
  @ApiNotFoundResponse({ description: 'La inscripción solicitada no existe.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentMembershipDto: UpdateStudentMembershipDto,
  ) {
    return await this.studentMembershipsService.update(
      id,
      updateStudentMembershipDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una inscripción escolar',
    description:
      'Remueve permanentemente el registro de inscripción escolar del sistema.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Inscripción escolar eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La inscripción solicitada no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentMembershipsService.remove(id);
  }

  @Post(':id/finish')
  @ApiOperation({
    summary: 'Marcar inscripción como finalizada',
    description:
      'Cambia el estado de la inscripción a FINISHED de forma manual.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Motivo de finalización',
          example: 'Fin de temporada',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Estado cambiado a FINISHED correctamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede finalizar en su estado actual.',
  })
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return await this.studentMembershipsService.finish(id, reason);
  }

  @Post(':id/suspend')
  @ApiOperation({
    summary: 'Suspender inscripción escolar',
    description:
      'Cambia el estado de la inscripción a SUSPENDED de forma manual.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Motivo de la suspensión',
          example: 'Falta de pago',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Inscripción suspendida correctamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede suspender en su estado actual.',
  })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return await this.studentMembershipsService.suspend(id, reason);
  }

  @Post(':id/withdraw')
  @ApiOperation({
    summary: 'Marcar retiro voluntario de una inscripción escolar',
    description: 'Cambia el estado de la inscripción a WITHDRAWN.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Motivo del retiro voluntario',
          example: 'Cambio de domicilio',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Inscripción retirada voluntariamente con éxito.',
  })
  @ApiBadRequestResponse({ description: 'La inscripción no se puede retirar.' })
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return await this.studentMembershipsService.withdraw(id, reason);
  }

  @Post(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivar inscripción escolar suspendida',
    description:
      'Retorna al estado ACTIVE a un estudiante que estaba suspendido.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Notas de reactivación',
          example: 'Regularizó deudas',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'Inscripción reactivada exitosamente.' })
  @ApiBadRequestResponse({
    description: 'Solo inscripciones suspendidas pueden ser reactivadas.',
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return await this.studentMembershipsService.reactivate(id, reason);
  }
}
