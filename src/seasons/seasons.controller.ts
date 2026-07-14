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
import { ExtendSeasonDto } from './dto/extend.dto';
import { FinalizeSeasonDto } from './dto/finalize.dto';
import { CancelSeasonDto } from './dto/cancel.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { SeasonResponseDto } from '../common/dto/responses/entities.dto';

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
  @ApiStandardCreatedResponse(SeasonResponseDto, 'Temporada creada exitosamente.')
  async create(@Body() createSeasonDto: CreateSeasonDto) {
    return await this.seasonsService.create(createSeasonDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar temporadas',
    description:
      'Retorna una lista paginada y filtrable de todas las temporadas deportivas.',
  })
  @ApiPaginatedResponse(SeasonResponseDto, 'Lista de temporadas obtenida correctamente.')
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
  @ApiStandardResponse(SeasonResponseDto, 'Temporada encontrada exitosamente.')
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
  @ApiStandardResponse(SeasonResponseDto, 'Temporada actualizada con éxito.')
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
  @ApiStandardResponse(SeasonResponseDto, 'Temporada eliminada con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.seasonsService.remove(id);
  }

  @Patch(':id/extend')
  @ApiOperation({
    summary: 'Extender temporada',
    description: 'Extiende la fecha de finalización de una temporada y guarda el evento.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada a extender (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SeasonResponseDto, 'Temporada extendida con éxito.')
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() extendSeasonDto: ExtendSeasonDto,
  ) {
    return await this.seasonsService.extend(id, extendSeasonDto);
  }

  @Patch(':id/finish')
  @ApiOperation({
    summary: 'Finalizar temporada',
    description: 'Marca la temporada como FINALIZADA y guarda el evento con el motivo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada a finalizar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SeasonResponseDto, 'Temporada finalizada con éxito.')
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() finalizeSeasonDto: FinalizeSeasonDto,
  ) {
    return await this.seasonsService.finish(id, finalizeSeasonDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar temporada',
    description: 'Marca la temporada como CANCELADA y guarda el evento con el motivo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la temporada a cancelar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SeasonResponseDto, 'Temporada cancelada con éxito.')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelSeasonDto: CancelSeasonDto,
  ) {
    return this.seasonsService.cancel(id, cancelSeasonDto);
  }

  @Post('auto-finalize')
  @ApiOperation({
    summary: 'Finalizar temporadas expiradas automáticamente (Cron)',
    description:
      'Busca todas las temporadas activas cuya fecha de fin ya pasó y las marca como FINISHED.',
  })
  async autoFinalize() {
    return await this.seasonsService.autoFinalizeExpiredSeasons();
  }
}
