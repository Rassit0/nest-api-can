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

@ApiTags('Team Seasons')
@Controller('team-seasons')
export class TeamSeasonsController {
  constructor(private readonly teamSeasonsService: TeamSeasonService) {}

  @Post()
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

  @Get()
  @ApiOperation({
    summary: 'Listar equipos instanciados en temporadas',
    description:
      'Retorna una lista paginada y filtrable de todas las instancias de equipos por periodos.',
  })
  @ApiPaginatedResponse(TeamSeasonResponseDto, 'Lista obtenida correctamente.')
  async findAll(@Query() paginationDto: TeamCategorySeasonsPaginationDto) {
    return await this.teamSeasonsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener instancia de equipo por ID',
    description:
      'Busca y retorna los detalles completos de una instancia de equipo en temporada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la instancia (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    TeamSeasonResponseDto,
    'Instancia encontrada exitosamente.',
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.findOne(id);
  }

  @Patch(':id')
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

  @Get('categories-by-discipline/options/:disciplineId')
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

  @Patch(':id/finish')
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
  @ApiOperation({
    summary: 'Activar/Desactivar motor de cobros por ID',
    description: 'Pausa o reanuda la generación automática de cargos y multas para esta temporada.',
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
        isEngineActive: { type: 'boolean', example: false } 
      } 
    } 
  })
  @ApiStandardResponse(
    TeamSeasonResponseDto, // Re-utilizamos esto o devuelves solo un config.
    'Motor de cobros actualizado exitosamente.',
  )
  async toggleBillingEngine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isEngineActive') isEngineActive: boolean,
  ) {
    return await this.teamSeasonsService.toggleBillingEngine(id, isEngineActive);
  }

  @Get(':id/pauses')
  @ApiOperation({
    summary: 'Obtener las pausas de la temporada',
  })
  async getPauses(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.getPauses(id);
  }

  @Post(':id/pauses')
  @ApiOperation({
    summary: 'Agregar una pausa a la temporada (vacaciones/receso)',
  })
  async addPause(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() createPauseDto: CreateTeamSeasonPauseDto,
  ) {
    return await this.teamSeasonsService.addPause(id, createPauseDto);
  }

  @Delete('pauses/:pauseId')
  @ApiOperation({
    summary: 'Eliminar una pausa de temporada',
  })
  async removePause(@Param('pauseId', ParseUUIDPipe) pauseId: string) {
    return await this.teamSeasonsService.removePause(pauseId);
  }
}
