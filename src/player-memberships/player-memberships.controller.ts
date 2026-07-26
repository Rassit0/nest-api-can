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
  BadRequestException,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlayerMembershipsService } from './player-memberships.service';
import { CreatePlayerMembershipDto } from './dto/create-player-membership.dto';
import { UpdatePlayerMembershipDto } from './dto/update-player-membership.dto';
import { PlayerMembershipsPaginationDto } from './dto/pagination.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { PlayerMembershipResponseDto } from '../common/dto/responses/entities.dto';
import { PaginationDto } from 'src/common/dto/pagination';
import { ChangeActivateStatusDto } from './dto/change-activate-status.dto';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PlayersOptionsPaginationDto } from './dto/players-options-pagination.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';

@ApiTags('Player Memberships')
@Controller('player-memberships')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class PlayerMembershipsController {
  constructor(
    private readonly playerMembershipsService: PlayerMembershipsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Inscribir un jugador a un equipo',
    description:
      'Inscribe a un jugador en una instancia de equipo en temporada validando categorías, edad y cupos.',
  })
  @ApiStandardCreatedResponse(
    PlayerMembershipResponseDto,
    'Membresía/inscripción de jugador creada con éxito.',
  )
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async create(@Body() createPlayerMembershipDto: CreatePlayerMembershipDto) {
    return await this.playerMembershipsService.create(
      createPlayerMembershipDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar inscripciones de jugadores',
    description:
      'Retorna una lista paginada y filtrable de todas las membresías/inscripciones de jugadores.',
  })
  @ApiPaginatedResponse(
    PlayerMembershipResponseDto,
    'Lista de inscripciones obtenida correctamente.',
  )
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS')
  async findAll(@Query() paginationDto: PlayerMembershipsPaginationDto) {
    return await this.playerMembershipsService.findAll(paginationDto);
  }

  @Get('players-options')
  @ApiOperation({
    summary: 'Listar opciones de jugadores',
    description: 'Retorna una lista paginada y filtrable de jugadores.',
  })
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS')
  async getAvailablePersons(
    @Query() paginationDto: PlayersOptionsPaginationDto,
  ) {
    return await this.playerMembershipsService.getPlayersOptions(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener inscripción de jugador por ID',
    description:
      'Retorna los detalles y plan de pagos de una inscripción de jugador.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    PlayerMembershipResponseDto,
    'Inscripción encontrada exitosamente.',
  )
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playerMembershipsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar inscripción de jugador por ID',
    description: 'Modifica los parámetros (fechas o plan) de una membresía.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdatePlayerMembershipDto })
  @ApiStandardResponse(
    PlayerMembershipResponseDto,
    'Inscripción actualizada exitosamente.',
  )
  @RequirePermissions('UPDATE_PLAYER_MEMBERSHIPS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerMembershipDto: UpdatePlayerMembershipDto,
  ) {
    return await this.playerMembershipsService.update(
      id,
      updatePlayerMembershipDto,
    );
  }

  @Delete(':id')
  @RequirePermissions('DELETE_PLAYER_MEMBERSHIPS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.playerMembershipsService.remove(id);
  }

  @Post('finish/:id')
  @ApiOperation({
    summary: 'Finalizar inscripción de jugador',
    description: 'Marca el estado de la membresía como FINISHED.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Inscripción finalizada exitosamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede finalizar en su estado actual.',
  })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.finish(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('suspend/:id')
  @ApiOperation({
    summary: 'Suspender inscripción de jugador',
    description: 'Cambia el estado de la membresía a SUSPENDED.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Inscripción suspendida correctamente.' })
  @ApiBadRequestResponse({
    description: 'La inscripción no se puede suspender.',
  })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.suspend(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('withdraw/:id')
  @ApiOperation({
    summary: 'Retiro voluntario de inscripción de jugador',
    description: 'Marca el estado de la membresía como WITHDRAWN.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({
    description: 'Inscripción marcada como retiro voluntario exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'La inscripción no se puede retirar.' })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.withdraw(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('reactivate/:id')
  @ApiOperation({
    summary: 'Reactivar inscripción de jugador suspendida',
    description: 'Retorna al estado ACTIVE a una membresía suspendida.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeStatusDto })
  @ApiOkResponse({ description: 'Inscripción reactivada correctamente.' })
  @ApiBadRequestResponse({
    description: 'Solo membresías suspendidas pueden reactivarse.',
  })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.reactivate(
      id,
      changeStatusDto.reason,
    );
  }

  @Post('activate/:id')
  @ApiOperation({
    summary: 'Activar inscripción de jugador',
    description: 'Pasa el estado de PENDING_ACTIVE a ACTIVE.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la inscripción (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: ChangeActivateStatusDto })
  @ApiOkResponse({ description: 'Inscripción activada correctamente.' })
  @ApiBadRequestResponse({
    description: 'Solo membresías pendientes pueden activarse.',
  })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeActivateStatusDto,
  ) {
    return await this.playerMembershipsService.activate(
      id,
      changeStatusDto.reason,
    );
  }

  @Get(':id/pauses')
  @ApiOperation({ summary: 'Obtener las pausas de una membresía' })
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS')
  async getPauses(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playerMembershipsService.getPauses(id);
  }

  @Post(':id/pauses')
  @ApiOperation({ summary: 'Crear una nueva pausa para la membresía' })
  @RequirePermissions('CREATE_PLAYER_MEMBERSHIPS')
  async createPause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: import('./dto/create-player-membership-pause.dto').CreatePlayerMembershipPauseDto,
  ) {
    return await this.playerMembershipsService.createPause(id, dto);
  }

  @Delete(':id/pauses/:pauseId')
  @ApiOperation({ summary: 'Eliminar una pausa de la membresía' })
  @RequirePermissions('DELETE_PLAYER_MEMBERSHIPS')
  async removePause(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pauseId', ParseUUIDPipe) pauseId: string,
  ) {
    return await this.playerMembershipsService.removePause(id, pauseId);
  }

  @Get('team-season/context/:teamSeasonId')
  @ApiOperation({
    summary: 'Obtener contexto básico del equipo',
    description:
      'Retorna información básica (nombre, id) de un equipo para usar de contexto en la vista de temporadas',
  })
  @ApiParam({
    name: 'teamSeasonId',
    description: 'ID de la temporada del equipo (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Contexto del equipo obtenido correctamente.' })
  @RequirePermissions('READ_PLAYER_MEMBERSHIPS')
  async getTeamContext(
    @Param('teamSeasonId', ParseUUIDPipe) teamSeasonId: string,
  ) {
    return await this.playerMembershipsService.getTeamSeasonContext(
      teamSeasonId,
    );
  }
}
