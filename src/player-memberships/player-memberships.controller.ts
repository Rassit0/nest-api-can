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
import { PlayerMembershipsService } from './player-memberships.service';
import { CreatePlayerMembershipDto } from './dto/create-player-membership.dto';
import { UpdatePlayerMembershipDto } from './dto/update-player-membership.dto';
import { PlayerMembershipsPaginationDto } from './dto/pagination.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@ApiTags('Player Memberships')
@Controller('player-memberships')
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
  @ApiCreatedResponse({
    description: 'Membresía/inscripción de jugador creada con éxito.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
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
  @ApiOkResponse({
    description: 'Lista de inscripciones obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: PlayerMembershipsPaginationDto) {
    return await this.playerMembershipsService.findAll(paginationDto);
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
  @ApiOkResponse({ description: 'Inscripción encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La inscripción no existe.' })
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
  @ApiOkResponse({ description: 'Inscripción actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La inscripción no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerMembershipDto: UpdatePlayerMembershipDto,
  ) {
    return await this.playerMembershipsService.update(
      id,
      updatePlayerMembershipDto,
    );
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
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.reactivate(
      id,
      changeStatusDto.reason,
    );
  }
}
