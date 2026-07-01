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
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayerPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';

@ApiTags('Players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un jugador',
    description: 'Vincula una persona existente como jugador activo del club.',
  })
  @ApiCreatedResponse({ description: 'Jugador registrado exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createPlayerDto: CreatePlayerDto) {
    return await this.playersService.create(createPlayerDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar jugadores',
    description:
      'Retorna una lista paginada y filtrable de todos los jugadores del club.',
  })
  @ApiOkResponse({ description: 'Lista de jugadores obtenida correctamente.' })
  async findAll(@Query() paginationDto: PlayerPaginationDto) {
    return await this.playersService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener jugador por ID',
    description:
      'Busca y retorna la información personal y deportiva del jugador por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del jugador (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Jugador encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El jugador no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar jugador por ID',
    description:
      'Modifica detalles de vinculación o ficha del jugador por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del jugador a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdatePlayerDto })
  @FormDataRequest()
  @ApiOkResponse({ description: 'Ficha de jugador actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'El jugador no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerDto: UpdatePlayerDto,
  ) {
    return await this.playersService.update(id, updatePlayerDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar jugador por ID',
    description: 'Desvincula permanentemente al jugador del club.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del jugador a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Jugador desvinculado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El jugador no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playersService.remove(id);
  }
}
