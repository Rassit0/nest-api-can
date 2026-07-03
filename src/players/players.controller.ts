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
import { PaginationDto } from 'src/common/dto/pagination';
import { FormDataRequest } from 'nestjs-form-data';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { PlayerResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un jugador',
    description: 'Vincula una persona existente como jugador activo del club.',
  })
  @ApiStandardCreatedResponse(
    PlayerResponseDto,
    'Jugador registrado exitosamente.',
  )
  async create(@Body() createPlayerDto: CreatePlayerDto) {
    return await this.playersService.create(createPlayerDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar jugadores',
    description:
      'Retorna una lista paginada y filtrable de todos los jugadores del club.',
  })
  @ApiPaginatedResponse(
    PlayerResponseDto,
    'Lista de jugadores obtenida correctamente.',
  )
  async findAll(@Query() paginationDto: PlayerPaginationDto) {
    return await this.playersService.findAll(paginationDto);
  }

  @Get('available-persons-options')
  @ApiOperation({
    summary: 'Listar opciones de personas no jugadores',
    description:
      'Retorna una lista paginada y filtrable de personas que no están registradas como jugadores.',
  })
  async getAvailablePersons(@Query() paginationDto: PaginationDto) {
    return await this.playersService.getAvailablePersons(paginationDto);
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
  @ApiStandardResponse(PlayerResponseDto, 'Jugador encontrado exitosamente.')
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
  @ApiStandardResponse(
    PlayerResponseDto,
    'Ficha de jugador actualizada exitosamente.',
  )
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
  @ApiStandardResponse(PlayerResponseDto, 'Jugador desvinculado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playersService.remove(id);
  }
}
