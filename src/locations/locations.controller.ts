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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { LocationResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Locations')
@Controller('locations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una ubicación',
    description:
      'Registra un espacio físico o cancha utilizable para entrenamientos, sesiones y horarios de disciplinas.',
  })
  @ApiStandardCreatedResponse(
    LocationResponseDto,
    'Ubicación física creada exitosamente.',
  )
  @RequirePermissions('CREATE_LOCATIONS')
  async create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar ubicaciones',
    description:
      'Retorna una lista paginada y filtrable de todas las ubicaciones registradas.',
  })
  @ApiPaginatedResponse(
    LocationResponseDto,
    'Lista de ubicaciones obtenida correctamente.',
  )
  @RequirePermissions('READ_LOCATIONS')
  async findAll(@Query() paginationDto: LocationsPaginationDto) {
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
  @ApiStandardResponse(
    LocationResponseDto,
    'Ubicación encontrada exitosamente.',
  )
  @RequirePermissions('READ_LOCATIONS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
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
  @ApiStandardResponse(
    LocationResponseDto,
    'Ubicación actualizada exitosamente.',
  )
  @RequirePermissions('UPDATE_LOCATIONS')
  async update(
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
  @ApiStandardResponse(LocationResponseDto, 'Ubicación eliminada con éxito.')
  @RequirePermissions('DELETE_LOCATIONS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }
}
