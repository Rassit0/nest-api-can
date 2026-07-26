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
  UseGuards,
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
  ApiConsumes,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TeamSeasonService } from './team-season.service';
import { CreateTeamSeasonDto } from './dto/create-team-season.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-season.dto';
import { FinalizeTeamSeasonDto } from './dto/finalize-team-season.dto';
import { CancelTeamSeasonDto } from './dto/cancel-team-season.dto';
import { CreateTeamSeasonPauseDto } from './dto/create-team-season-pause.dto';
import { TeamCategorySeasonsPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { TeamSeasonResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Team Seasons')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('team-seasons')
export class TeamSeasonsController {
  constructor(private readonly teamSeasonsService: TeamSeasonService) {}

  @Post()
  @RequirePermissions('CREATE_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Instanciar un equipo en una temporada',
    description:
      'Asigna una categoría y una temporada (periodo activo) a un equipo específico con cuotas comerciales.',
  })
  // @ApiConsumes('multipart/form-data')
  // @FormDataRequest()
  @ApiStandardCreatedResponse(
    TeamSeasonResponseDto,
    'Equipo instanciado en temporada exitosamente.',
  )
  async create(@Body() createTeamCategoryDto: CreateTeamSeasonDto) {
    return await this.teamSeasonsService.create(createTeamCategoryDto);
  }

  @Get('public/list')
  @ApiOperation({
    summary: 'Listar equipos públicos',
    description:
      'Retorna una lista adaptada para el portal web con información pública de los equipos.',
  })
  @ApiOkResponse({ description: 'Equipos públicos obtenidos correctamente.' })
  @RequirePermissions('READ_TEAM_SEASONS')
  async findPublic(@Query('isHistorical') isHistorical?: string) {
    const historical = isHistorical === 'true';
    return await this.teamSeasonsService.findPublic(historical);
  }

  @Get()
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Listar equipos instanciados en temporadas',
    description:
      'Retorna una lista paginada y filtrable de todas las instancias de equipos por periodos.',
  })
  @ApiPaginatedResponse(TeamSeasonResponseDto, 'Lista obtenida correctamente.')
  async findAll(@Query() paginationDto: TeamCategorySeasonsPaginationDto) {
    return await this.teamSeasonsService.findAll(paginationDto);
  }

  @Get('categories-by-discipline/options/:disciplineId')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Listar categorías por disciplina para selectores',
    description: 'Retorna las categorías asociadas a una disciplina deportiva.',
  })
  @ApiParam({
    name: 'disciplineId',
    description: 'ID de la disciplina (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Opciones de categorías obtenidas con éxito.' })
  async getCategoriesByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamSeasonsService.getCategoriesByDisciplineOptions(
      disciplineId,
    );
  }

  @Get('seasons-by-discipline/options/:disciplineId')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Listar temporadas por disciplina para selectores',
    description: 'Retorna las temporadas de una disciplina deportiva.',
  })
  @ApiParam({
    name: 'disciplineId',
    description: 'ID de la disciplina (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Opciones de temporadas obtenidas con éxito.' })
  async getSeasonsByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamSeasonsService.getSeasonsByDisciplineOptions(
      disciplineId,
    );
  }

  @Delete('pauses/:pauseId')
  @RequirePermissions('PAUSE_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Eliminar una pausa de temporada',
  })
  async removePause(@Param('pauseId', ParseUUIDPipe) pauseId: string) {
    return await this.teamSeasonsService.removePause(pauseId);
  }

  @Get(':id')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener temporada de equipo por ID',
    description: 'Retorna los detalles de un equipo instanciado en temporada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada de equipo (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Temporada de equipo obtenida exitosamente.',
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.findOne(id);
  }

  @Get(':id/summary')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener resumen de la temporada',
    description: 'Retorna un resumen de métricas y cobranzas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada de equipo (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Resumen de temporada de equipo.' })
  async getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.getSummary(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Actualizar instancia de equipo por ID',
    description:
      'Modifica los parámetros de configuración y tarifas de un equipo instanciado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia a actualizar (UUID)',
    format: 'uuid',
  })
  // @ApiConsumes('multipart/form-data')
  // @FormDataRequest()
  @ApiBody({ type: UpdateTeamSeasonDto })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Instancia de equipo actualizada con éxito.',
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamCategoryDto: UpdateTeamSeasonDto,
  ) {
    return this.teamSeasonsService.update(id, updateTeamCategoryDto);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Eliminar instancia de equipo por ID',
    description:
      'Remueve de forma permanente la vinculación del equipo con la temporada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Instancia de equipo eliminada exitosamente.',
  )
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.remove(id);
  }

  @Patch(':id/finish')
  @RequirePermissions('FINISH_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Finalizar una temporada de equipo por ID',
    description: 'Marca la temporada de equipo como FINALIZADA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: FinalizeTeamSeasonDto })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Instancia finalizada exitosamente.',
  )
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() finalizeTeamSeasonDto: FinalizeTeamSeasonDto,
  ) {
    return await this.teamSeasonsService.finish(id, finalizeTeamSeasonDto);
  }

  @Patch(':id/cancel')
  @RequirePermissions('CANCEL_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Cancelar una temporada de equipo por ID',
    description: 'Marca la temporada de equipo como CANCELADA.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: CancelTeamSeasonDto })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Instancia cancelada exitosamente.',
  )
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelTeamSeasonDto: CancelTeamSeasonDto,
  ) {
    return await this.teamSeasonsService.cancel(id, cancelTeamSeasonDto);
  }

  @Patch(':id/toggle-billing-engine')
  @RequirePermissions('BILLING_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Activar/Desactivar motor de cobros por ID',
    description:
      'Pausa o reanuda la generación automática de cargos y multas para esta temporada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia de temporada (UUID)',
    format: 'uuid',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isEngineActive: { type: 'boolean', example: false },
      },
    },
  })
  @ApiStandardResponse(
    TeamSeasonResponseDto, // Re-utilizamos esto o devuelves solo un config.
    'Motor de cobros actualizado exitosamente.',
  )
  async toggleBillingEngine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isEngineActive') isEngineActive: boolean,
  ) {
    return await this.teamSeasonsService.toggleBillingEngine(
      id,
      isEngineActive,
    );
  }

  @Get(':id/pauses')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener las pausas de la temporada',
  })
  async getPauses(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.getPauses(id);
  }

  @Post(':id/pauses')
  @RequirePermissions('PAUSE_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Agregar una pausa a la temporada (vacaciones/receso)',
  })
  async addPause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createPauseDto: CreateTeamSeasonPauseDto,
  ) {
    return await this.teamSeasonsService.addPause(id, createPauseDto);
  }

  @Get('disciplines/options')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener opciones de disciplinas',
    description:
      'Retorna las disciplinas para selectores de la temporada de equipos.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de disciplinas obtenida correctamente.',
  })
  async getDisciplinesOptions() {
    return await this.teamSeasonsService.getDisciplinesOptions();
  }

  @Get('club/context/:clubId')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener contexto básico del club',
    description:
      'Retorna información básica (nombre, id) de un club para usar de contexto en la vista de temporadas',
  })
  @ApiParam({
    name: 'clubId',
    description: 'ID del club (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Contexto del club obtenido correctamente.' })
  async getClubContext(@Param('clubId', ParseUUIDPipe) clubId: string) {
    return await this.teamSeasonsService.getClubContext(clubId);
  }

  @Get('team/context/:teamId')
  @RequirePermissions('READ_TEAM_SEASONS')
  @ApiOperation({
    summary: 'Obtener contexto básico del equipo',
    description:
      'Retorna información básica (nombre, id) de un equipo para usar de contexto en la vista de temporadas',
  })
  @ApiParam({
    name: 'teamId',
    description: 'ID del equipo (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Contexto del equipo obtenido correctamente.' })
  async getTeamContext(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return await this.teamSeasonsService.getTeamContext(teamId);
  }
}
