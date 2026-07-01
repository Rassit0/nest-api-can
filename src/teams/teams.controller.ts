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
  ApiConsumes,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un equipo deportivo',
    description:
      'Registra un equipo (club, género, etc.) con su logo y metadatos.',
  })
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  @ApiCreatedResponse({ description: 'Equipo creado exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar equipos',
    description:
      'Retorna una lista paginada y filtrable de todos los equipos del sistema.',
  })
  @ApiOkResponse({ description: 'Lista de equipos obtenida correctamente.' })
  findAll(@Query() paginationDto: TeamsPaginationDto) {
    return this.teamsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener equipo por ID',
    description:
      'Busca y retorna los metadatos completos de un equipo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del equipo (UUID)', format: 'uuid' })
  @ApiOkResponse({ description: 'Equipo encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El equipo no existe.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar equipo por ID',
    description: 'Modifica datos y/o logo del equipo por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del equipo a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  @ApiBody({ type: UpdateTeamDto })
  @ApiOkResponse({ description: 'Equipo actualizado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El equipo no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar equipo por ID',
    description:
      'Remueve permanentemente el registro de un equipo del sistema.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del equipo a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Equipo eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El equipo no existe.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.remove(id);
  }

  @Get('clubs-by-discipline/options/:disciplineId')
  @ApiOperation({
    summary: 'Obtener clubes por disciplina',
    description:
      'Retorna los clubes asociados a una disciplina deportiva específica.',
  })
  @ApiParam({
    name: 'disciplineId',
    description: 'ID de la disciplina (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Opciones de clubes obtenidas correctamente.' })
  async getClubsByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamsService.getClubsByDisciplineOptions(disciplineId);
  }

  @Get('disciplines/options')
  @ApiOperation({
    summary: 'Obtener disciplinas disponibles para equipos',
    description: 'Retorna selectores de disciplinas deportivas.',
  })
  @ApiOkResponse({
    description: 'Opciones de disciplinas obtenidas correctamente.',
  })
  async getDisciplinesOptions() {
    return await this.teamsService.getDisciplinesOptions();
  }
}
