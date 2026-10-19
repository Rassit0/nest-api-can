import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { StaffAccessService } from './staff-access.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffPaginationDto } from './dto/pagination.dto';
import { MyGroupsResponseDto } from './dto/my-groups-response.dto';
import { StaffContextResponseDto } from './dto/staff-context-response.dto';
import { TeacherDashboardResponseDto } from './dto/teacher-dashboard-response.dto';
import { TeacherGroupContextResponseDto } from './dto/teacher-group-context-response.dto';
import { SessionAttendanceRosterResponseDto } from './dto/session-attendance-roster-response.dto';
import {
  BulkAttendanceDto,
  BulkAttendanceResponseDto,
} from './dto/bulk-attendance.dto';
import {
  TeacherCreateEvaluationDto,
  TeacherUpdateEvaluationDto,
  TeacherEvaluationItemDto,
  TeacherGroupEvaluationsResponseDto,
} from './dto/teacher-evaluation.dto';
import {
  TeacherCreateSessionDto,
  TeacherUpdateSessionDto,
  TeacherSessionDetailDto,
} from './dto/teacher-session.dto';
import {
  TeacherCreateIncidentDto,
  TeacherUpdateIncidentDto,
  TeacherIncidentItemDto,
  TeacherSessionIncidentsResponseDto,
} from './dto/teacher-incident.dto';
import { TeacherGroupSessionDto } from './dto/teacher-group-context-response.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { StaffResponseDto } from '../common/dto/responses/entities.dto';
import { PaginationDto } from 'src/common/dto/pagination';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Staff')
@Controller('staff')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly staffAccessService: StaffAccessService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un miembro del personal',
    description:
      'Crea la vinculación de personal (entrenador, auxiliar, etc.) a partir de un perfil de persona preexistente.',
  })
  @ApiStandardCreatedResponse(
    StaffResponseDto,
    'Miembro del personal registrado exitosamente.',
  )
  @RequirePermissions('CREATE_STAFF')
  async create(@Body() createStaffDto: CreateStaffDto, @Req() req: any) {
    return await this.staffService.create(createStaffDto, req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar miembros del personal',
    description:
      'Retorna una lista paginada y filtrable de todos los entrenadores/auxiliares.',
  })
  @ApiPaginatedResponse(
    StaffResponseDto,
    'Lista del personal obtenida correctamente.',
  )
  @RequirePermissions('READ_STAFF')
  async findAll(@Query() paginationDto: StaffPaginationDto) {
    return this.staffService.findAll(paginationDto);
  }

  @Get('me/context')
  @ApiOperation({
    summary: 'Obtener el contexto de Staff del usuario autenticado',
    description:
      'Retorna información de si el usuario actual es personal activo y si tiene asignaciones docentes activas (sin lanzar 403).',
  })
  @ApiStandardResponse(
    StaffContextResponseDto,
    'Contexto de staff obtenido exitosamente.',
  )
  async getStaffContext(@Req() req: any) {
    const user = req.user;
    const data = await this.staffAccessService.getStaffContext(user);
    return {
      message: 'Contexto de staff obtenido exitosamente',
      data,
    };
  }

  @Get('me/dashboard')
  @ApiOperation({
    summary: 'Obtener el dashboard del profesor/entrenador autenticado',
    description:
      'Retorna las métricas operativas resumidas, grupos activos asignados y próximas sesiones del profesor.',
  })
  @ApiStandardResponse(
    TeacherDashboardResponseDto,
    'Dashboard del profesor obtenido exitosamente.',
  )
  async getTeacherDashboard(@Req() req: any) {
    const user = req.user;
    const data = await this.staffAccessService.getTeacherDashboard(user);
    return {
      message: 'Dashboard obtenido exitosamente',
      data,
    };
  }

  @Get('me/groups')
  @ApiOperation({
    summary: 'Obtener los grupos asignados al profesor/entrenador autenticado',
    description:
      'Retorna la lista unificada de cursos escolares y equipos donde el usuario autenticado tiene asignación de Staff activa.',
  })
  @ApiStandardResponse(
    MyGroupsResponseDto,
    'Grupos del profesor obtenidos exitosamente.',
  )
  async getMyGroups(@Req() req: any) {
    const user = req.user;
    const data = await this.staffAccessService.getMyGroups(user);
    return {
      message: 'Grupos obtenidos exitosamente',
      data,
    };
  }

  @Get('me/groups/:type/:groupId')
  @ApiOperation({
    summary: 'Obtener el contexto detallado de un grupo asignado al profesor',
    description:
      'Retorna el contexto del grupo, roster canónico de participantes y sesiones (resuelto con autorización de recurso).',
  })
  @ApiParam({
    name: 'type',
    enum: ['COURSE', 'TEAM'],
    description: 'Tipo de grupo (COURSE o TEAM)',
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del grupo (courseSeasonShiftId o teamSeasonCategoryId)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeacherGroupContextResponseDto,
    'Contexto del grupo obtenido exitosamente.',
  )
  async getGroupContext(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.getGroupContext(
      user,
      type,
      groupId,
    );
    return {
      message: 'Contexto del grupo obtenido exitosamente',
      data,
    };
  }

  @Get('me/groups/:type/:groupId/sessions/:sessionId/attendance')
  @ApiOperation({
    summary:
      'Obtener el roster y estado de asistencia para una sesión específica del grupo',
    description:
      'Retorna el roster canónico de participantes habilitados para la fecha exacta de la sesión junto con las asistencias registradas hasta el momento.',
  })
  @ApiParam({
    name: 'type',
    enum: ['COURSE', 'TEAM'],
    description: 'Tipo de grupo (COURSE o TEAM)',
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del grupo (courseSeasonShiftId o teamSeasonCategoryId)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión de entrenamiento',
    format: 'uuid',
  })
  @ApiStandardResponse(
    SessionAttendanceRosterResponseDto,
    'Roster y asistencias de la sesión obtenidos exitosamente.',
  )
  @RequirePermissions('READ_SESSION_BOOKINGS')
  async getSessionAttendanceRoster(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.getSessionAttendanceRoster(
      user,
      type,
      groupId,
      sessionId,
    );
    return {
      message: 'Roster y asistencias obtenidos exitosamente',
      data,
    };
  }

  @Put('me/groups/:type/:groupId/sessions/:sessionId/attendance')
  @ApiOperation({
    summary:
      'Guardar la asistencia masiva de los participantes para una sesión',
    description:
      'Guarda de forma atómica e idempotente el estado de asistencia de los participantes especificados en la sesión.',
  })
  @ApiParam({
    name: 'type',
    enum: ['COURSE', 'TEAM'],
    description: 'Tipo de grupo (COURSE o TEAM)',
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del grupo (courseSeasonShiftId o teamSeasonCategoryId)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión de entrenamiento',
    format: 'uuid',
  })
  @ApiBody({ type: BulkAttendanceDto })
  @ApiStandardResponse(
    BulkAttendanceResponseDto,
    'Asistencia masiva guardada exitosamente.',
  )
  @RequirePermissions('CREATE_SESSION_BOOKINGS', 'UPDATE_SESSION_BOOKINGS')
  async saveSessionAttendanceBulk(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() bulkDto: BulkAttendanceDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.saveSessionAttendanceBulk(
      user,
      type,
      groupId,
      sessionId,
      bulkDto,
    );
    return {
      message: 'Asistencia registrada exitosamente',
      data,
    };
  }

  @Get('me/groups/:type/:groupId/evaluations')
  @ApiOperation({
    summary: 'Obtener evaluaciones de un grupo asignado',
    description:
      'Retorna el historial de evaluaciones del turno o categoría asignada con aislamiento total por grupo.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeacherGroupEvaluationsResponseDto,
    'Historial de evaluaciones del grupo obtenido exitosamente.',
  )
  @RequirePermissions('READ_PROGRESS_EVALUATIONS')
  async getGroupEvaluations(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('participantId') participantId?: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.getGroupEvaluations(
      user,
      type,
      groupId,
      participantId,
    );
    return {
      message: 'Evaluaciones obtenidas exitosamente',
      data,
    };
  }

  @Post('me/groups/:type/:groupId/evaluations')
  @ApiOperation({
    summary: 'Registrar evaluación de progreso en un grupo asignado',
    description:
      'Crea una evaluación trazada inequívocamente al grupo operativo, derivando season y evaluador en servidor.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherCreateEvaluationDto })
  @ApiStandardCreatedResponse(
    TeacherEvaluationItemDto,
    'Evaluación registrada exitosamente.',
  )
  @RequirePermissions('CREATE_PROGRESS_EVALUATIONS')
  async createGroupEvaluation(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: TeacherCreateEvaluationDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.createGroupEvaluation(
      user,
      type,
      groupId,
      dto,
    );
    return {
      message: 'Evaluación registrada exitosamente',
      data,
    };
  }

  @Patch('me/groups/:type/:groupId/evaluations/:evaluationId')
  @ApiOperation({
    summary: 'Actualizar evaluación de progreso en un grupo asignado',
    description:
      'Modifica scores y notas de una evaluación. Requiere que el evaluador sea el usuario autenticado.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'evaluationId',
    description: 'ID de la evaluación (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherUpdateEvaluationDto })
  @ApiStandardResponse(
    TeacherEvaluationItemDto,
    'Evaluación actualizada exitosamente.',
  )
  @RequirePermissions('UPDATE_PROGRESS_EVALUATIONS')
  async updateGroupEvaluation(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('evaluationId', ParseUUIDPipe) evaluationId: string,
    @Body() dto: TeacherUpdateEvaluationDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.updateGroupEvaluation(
      user,
      type,
      groupId,
      evaluationId,
      dto,
    );
    return {
      message: 'Evaluación actualizada exitosamente',
      data,
    };
  }

  // ==========================================
  // PHASE F: TEACHER-SCOPED SESSIONS & INCIDENTS
  // ==========================================

  @Get('me/locations')
  @ApiOperation({
    summary: 'Obtener ubicaciones disponibles para programación de sesiones',
    description:
      'Retorna las ubicaciones físicas activas del club para asignación a sesiones de entrenamiento.',
  })
  async getLocations() {
    const data = await this.staffAccessService.getAvailableLocations();
    return {
      message: 'Ubicaciones obtenidas exitosamente',
      data,
    };
  }

  @Post('me/groups/:type/:groupId/sessions')
  @ApiOperation({
    summary: 'Programar una nueva sesión de entrenamiento en el grupo asignado',
    description:
      'Crea una sesión vinculada exclusivamente al turno o categoría del path, validando rol y asignación activa.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherCreateSessionDto })
  @ApiStandardCreatedResponse(
    TeacherGroupSessionDto,
    'Sesión creada exitosamente.',
  )
  @RequirePermissions('CREATE_SESSIONS')
  async createGroupSession(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: TeacherCreateSessionDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.createGroupSession(
      user,
      type,
      groupId,
      dto,
    );
    return {
      message: 'Sesión creada exitosamente',
      data,
    };
  }

  @Get('me/groups/:type/:groupId/sessions/:sessionId')
  @ApiOperation({
    summary: 'Consultar detalles de una sesión del grupo asignado',
    description:
      'Retorna la información completa de la sesión asegurando pertenencia al grupo autorizado.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeacherSessionDetailDto,
    'Detalles de la sesión obtenidos exitosamente.',
  )
  @RequirePermissions('READ_SESSIONS')
  async getGroupSession(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.getGroupSession(
      user,
      type,
      groupId,
      sessionId,
    );
    return {
      message: 'Detalle de sesión obtenido exitosamente',
      data,
    };
  }

  @Patch('me/groups/:type/:groupId/sessions/:sessionId')
  @ApiOperation({
    summary: 'Actualizar una sesión del grupo asignado',
    description:
      'Modifica fecha, horario o recinto de una sesión autorizada con validación de integridad histórica.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherUpdateSessionDto })
  @ApiStandardResponse(
    TeacherGroupSessionDto,
    'Sesión actualizada exitosamente.',
  )
  @RequirePermissions('UPDATE_SESSIONS')
  async updateGroupSession(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: TeacherUpdateSessionDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.updateGroupSession(
      user,
      type,
      groupId,
      sessionId,
      dto,
    );
    return {
      message: 'Sesión actualizada exitosamente',
      data,
    };
  }

  @Post('me/groups/:type/:groupId/sessions/:sessionId/cancel')
  @ApiOperation({
    summary: 'Cancelar una sesión del grupo asignado',
    description:
      'Marca el estado del evento como CANCELLED preservando las asistencias y registros históricos.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeacherGroupSessionDto,
    'Sesión cancelada exitosamente.',
  )
  @RequirePermissions('UPDATE_SESSIONS')
  async cancelGroupSession(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.cancelGroupSession(
      user,
      type,
      groupId,
      sessionId,
    );
    return {
      message: 'Sesión cancelada exitosamente',
      data,
    };
  }

  @Get('me/groups/:type/:groupId/sessions/:sessionId/incidents')
  @ApiOperation({
    summary: 'Consultar incidentes u observaciones disciplinarias de la sesión',
    description:
      'Retorna la lista de reportes de indisciplina asociados a participantes en la sesión.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeacherSessionIncidentsResponseDto,
    'Lista de incidentes obtenida exitosamente.',
  )
  @RequirePermissions('READ_SESSION_INCIDENTS')
  async getGroupSessionIncidents(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.getGroupSessionIncidents(
      user,
      type,
      groupId,
      sessionId,
    );
    return {
      message: 'Incidentes obtenidos exitosamente',
      data,
    };
  }

  @Post('me/groups/:type/:groupId/sessions/:sessionId/incidents')
  @ApiOperation({
    summary: 'Registrar un reporte de incidente de conducta en una sesión',
    description:
      'Asocia una observación disciplinaria a un participante autorizado dentro de la sesión.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherCreateIncidentDto })
  @ApiStandardCreatedResponse(
    TeacherIncidentItemDto,
    'Incidente registrado exitosamente.',
  )
  @RequirePermissions('CREATE_SESSION_INCIDENTS')
  async createGroupSessionIncident(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: TeacherCreateIncidentDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.createGroupSessionIncident(
      user,
      type,
      groupId,
      sessionId,
      dto,
    );
    return {
      message: 'Incidente registrado exitosamente',
      data,
    };
  }

  @Patch('me/groups/:type/:groupId/sessions/:sessionId/incidents/:incidentId')
  @ApiOperation({
    summary: 'Actualizar la descripción de un incidente en la sesión',
    description:
      'Modifica el reporte disciplinario. Requiere que el autor sea el usuario autenticado.',
  })
  @ApiParam({
    name: 'type',
    description: 'Tipo de grupo (COURSE o TEAM)',
    enum: ['COURSE', 'TEAM', 'course', 'team'],
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID del turno o categoría asignada (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'ID de la sesión (UUID)',
    format: 'uuid',
  })
  @ApiParam({
    name: 'incidentId',
    description: 'ID del incidente (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: TeacherUpdateIncidentDto })
  @ApiStandardResponse(
    TeacherIncidentItemDto,
    'Incidente actualizado exitosamente.',
  )
  @RequirePermissions('UPDATE_SESSION_INCIDENTS')
  async updateGroupSessionIncident(
    @Req() req: any,
    @Param('type') type: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() dto: TeacherUpdateIncidentDto,
  ) {
    const user = req.user;
    const data = await this.staffAccessService.updateGroupSessionIncident(
      user,
      type,
      groupId,
      sessionId,
      incidentId,
      dto,
    );
    return {
      message: 'Incidente actualizado exitosamente',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener personal por ID',
    description:
      'Retorna los datos completos de perfil y vinculación del personal por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal encontrado exitosamente.',
  )
  @RequirePermissions('READ_STAFF')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar personal por ID',
    description: 'Modifica datos de ficha o vigencia del personal por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStaffDto })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal actualizado exitosamente.',
  )
  @RequirePermissions('UPDATE_STAFF')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStaffDto: UpdateStaffDto,
    @Req() req: any,
  ) {
    return await this.staffService.update(id, updateStaffDto, req.user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar personal por ID',
    description:
      'Desactiva lógicamente el registro de personal sin eliminar registros históricos.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a desactivar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal desactivado exitosamente.',
  )
  @RequirePermissions('DELETE_STAFF')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return await this.staffService.deactivate(id, req.user);
  }

  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivar personal por ID',
    description: 'Reactiva la ficha del miembro del personal.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a reactivar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal reactivado exitosamente.',
  )
  @RequirePermissions('UPDATE_STAFF')
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return await this.staffService.reactivate(id, req.user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar personal por ID (Desactivación lógica)',
    description:
      'Desactiva lógicamente el registro de personal preservando trazabilidad e integridad histórica.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a desactivar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal desactivado exitosamente.',
  )
  @RequirePermissions('DELETE_STAFF')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.staffService.remove(id, req.user);
  }
}
