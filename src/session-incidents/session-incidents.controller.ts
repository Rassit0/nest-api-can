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
import { SessionIncidentsService } from './session-incidents.service';
import { CreateSessionIncidentDto } from './dto/create-session-incident.dto';
import { UpdateSessionIncidentDto } from './dto/update-session-incident.dto';
import { SessionIncidentsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { SessionIncidentResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Session Incidents')
@Controller('session-incidents')
export class SessionIncidentsController {
  constructor(
    private readonly sessionIncidentsService: SessionIncidentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un incidente de mala conducta en una sesión',
    description:
      'Registra un reporte de indisciplina o actitud negativa asociado a la asistencia de una clase o sesión para un estudiante o jugador.',
  })
  @ApiStandardCreatedResponse(SessionIncidentResponseDto, 'Reporte de incidente de conducta creado con éxito.')
  async create(@Body() createSessionIncidentDto: CreateSessionIncidentDto) {
    return await this.sessionIncidentsService.create(createSessionIncidentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de incidentes de conducta',
    description:
      'Retorna una lista paginada y filtrable de todos los incidentes disciplinarios reportados.',
  })
  @ApiPaginatedResponse(SessionIncidentResponseDto, 'Lista de incidentes obtenida correctamente.')
  async findAll(@Query() paginationDto: SessionIncidentsPaginationDto) {
    return await this.sessionIncidentsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un incidente por ID',
    description:
      'Busca y retorna la información completa de un reporte de indisciplina por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del incidente disciplinario (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SessionIncidentResponseDto, 'Incidente disciplinario encontrado con éxito.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionIncidentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar la descripción de un incidente',
    description:
      'Modifica la descripción o los detalles de un reporte de conducta por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del incidente a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateSessionIncidentDto })
  @ApiStandardResponse(SessionIncidentResponseDto, 'Detalles del incidente actualizados con éxito.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSessionIncidentDto: UpdateSessionIncidentDto,
  ) {
    return await this.sessionIncidentsService.update(
      id,
      updateSessionIncidentDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un incidente registrado',
    description:
      'Remueve de manera permanente el reporte de indisciplina del historial de la asistencia.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del incidente a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SessionIncidentResponseDto, 'Reporte de conducta eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionIncidentsService.remove(id);
  }
}
