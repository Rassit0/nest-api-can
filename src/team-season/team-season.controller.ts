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
}
