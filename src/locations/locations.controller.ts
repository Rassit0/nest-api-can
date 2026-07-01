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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsPaginationDto } from './dto/pagination.dto';

@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una ubicación',
    description:
      'Registra un espacio físico o cancha utilizable para entrenamientos, sesiones y horarios de disciplinas.',
  })
  @ApiCreatedResponse({ description: 'Ubicación física creada exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar ubicaciones',
    description:
      'Retorna una lista paginada y filtrable de todas las ubicaciones registradas.',
  })
  @ApiOkResponse({
    description: 'Lista de ubicaciones obtenida correctamente.',
  })
  findAll(@Query() paginationDto: LocationsPaginationDto) {
    return this.locationsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener ubicación por ID',
    description: 'Retorna los detalles y metadatos de una ubicación por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la ubicación (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Ubicación encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La ubicación no existe.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar ubicación por ID',
    description:
      'Modifica datos (nombre, descripción, dirección, capacidad) de una ubicación por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la ubicación a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateLocationDto })
  @ApiOkResponse({ description: 'Ubicación actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La ubicación no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar ubicación por ID',
    description: 'Remueve permanentemente el registro de ubicación física.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la ubicación a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Ubicación eliminada con éxito.' })
  @ApiNotFoundResponse({ description: 'La ubicación no existe.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }
}
