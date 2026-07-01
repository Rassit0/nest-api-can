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
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { SeasonsPaginationDto } from './dto/pagination.dto';

@ApiTags('Seasons')
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una temporada',
    description:
      'Registra un periodo deportivo activo (año/fase/curso) con rango de fechas en el sistema.',
  })
  @ApiCreatedResponse({ description: 'Temporada creada exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createSeasonDto: CreateSeasonDto) {
    return await this.seasonsService.create(createSeasonDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar temporadas',
    description:
      'Retorna una lista paginada y filtrable de todas las temporadas deportivas.',
  })
  @ApiOkResponse({ description: 'Lista de temporadas obtenida correctamente.' })
  async findAll(@Query() paginationDto: SeasonsPaginationDto) {
    return await this.seasonsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener temporada por ID',
    description:
      'Busca y retorna los metadatos completos de una temporada por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Temporada encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La temporada no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.seasonsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar temporada por ID',
    description: 'Modifica las fechas o nombre de una temporada por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateSeasonDto })
  @ApiOkResponse({ description: 'Temporada actualizada con éxito.' })
  @ApiNotFoundResponse({ description: 'La temporada no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSeasonDto: UpdateSeasonDto,
  ) {
    return await this.seasonsService.update(id, updateSeasonDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar temporada por ID',
    description: 'Remueve de forma permanente una temporada del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Temporada eliminada con éxito.' })
  @ApiNotFoundResponse({ description: 'La temporada no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.seasonsService.remove(id);
  }
}
