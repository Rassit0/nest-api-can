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
import { ChangeStatusDto } from './dto/change-status.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { StudentMembershipResponseDto } from '../common/dto/responses/entities.dto';
import { PaginationDto } from 'src/common/dto/pagination';
import { ChangeActivateStatusDto } from './dto/change-activate-status.dto';

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
  @ApiStandardCreatedResponse(
    StudentMembershipResponseDto,
    'Estudiante inscrito exitosamente.',
  )
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
  @ApiPaginatedResponse(
    StudentMembershipResponseDto,
    'Lista de inscripciones obtenida correctamente.',
  )
  async findAll(@Query() paginationDto: StudentMembershipsPaginationDto) {
    return await this.studentMembershipsService.findAll(paginationDto);
  }

  @Get('students-options')
  @ApiOperation({
    summary: 'Listar opciones de estudiantes',
    description: 'Retorna una lista paginada y filtrable de estudiantes.',
  })
  async getAvailableStudents(@Query() paginationDto: PaginationDto) {
    return await this.studentMembershipsService.getStudentsOptions(
      paginationDto,
    );
  }

  @Get('course-seasons-options')
  @ApiOperation({
    summary: 'Listar opciones de cursos',
    description:
      'Retorna una lista paginada y filtrable de temporadas de cursos.',
  })
  async getAvailableCourseSeasons(@Query() paginationDto: PaginationDto) {
    return await this.studentMembershipsService.getCourseSeasonsOptions(
      paginationDto,
    );
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
  @ApiStandardResponse(
    StudentMembershipResponseDto,
    'Inscripción escolar encontrada exitosamente.',
  )
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
  @ApiStandardResponse(
    StudentMembershipResponseDto,
    'Inscripción escolar actualizada exitosamente.',
  )
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
  @ApiStandardResponse(
    StudentMembershipResponseDto,
    'Inscripción escolar eliminada exitosamente.',
  )
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentMembershipsService.remove(id);
  }

  @Post('finish/:id')
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
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Estado cambiado a FINISHED correctamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede finalizar en su estado actual.',
  })
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.studentMembershipsService.finish(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('suspend/:id')
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
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Inscripción suspendida correctamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede suspender en su estado actual.',
  })
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.studentMembershipsService.suspend(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('withdraw/:id')
  @ApiOperation({
    summary: 'Marcar retiro voluntario de una inscripción escolar',
    description: 'Cambia el estado de la inscripción a WITHDRAWN.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({
    description: 'Inscripción retirada voluntariamente con éxito.',
  })
  @ApiBadRequestResponse({ description: 'La inscripción no se puede retirar.' })
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.studentMembershipsService.withdraw(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('reactivate/:id')
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
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Inscripción reactivada exitosamente.' })
  @ApiBadRequestResponse({
    description: 'Solo inscripciones suspendidas pueden ser reactivadas.',
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.studentMembershipsService.reactivate(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('activate/:id')
  @ApiOperation({
    summary: 'Activar inscripción escolar pendiente',
    description: 'Cambia el estado de PENDING_ACTIVE a ACTIVE de forma manual.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeActivateStatusDto })
  @ApiOkResponse({ description: 'Inscripción activada exitosamente.' })
  @ApiBadRequestResponse({
    description: 'Solo inscripciones pendientes pueden ser activadas.',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeActivateStatusDto,
  ) {
    return await this.studentMembershipsService.activate(
      id,
      changeStatusDto.reason,
    );
  }

  @Get(':id/pauses')
  @ApiOperation({ summary: 'Obtener las pausas de una membresía' })
  async getPauses(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentMembershipsService.getPauses(id);
  }

  @Post(':id/pauses')
  @ApiOperation({ summary: 'Crear una nueva pausa para la membresía' })
  async createPause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: import('./dto/create-student-membership-pause.dto').CreateStudentMembershipPauseDto,
  ) {
    return await this.studentMembershipsService.createPause(id, dto);
  }

  @Delete(':id/pauses/:pauseId')
  @ApiOperation({ summary: 'Eliminar una pausa de la membresía' })
  async removePause(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
  ) {
    return await this.studentMembershipsService.removePause(id, pauseId);
  }
}
