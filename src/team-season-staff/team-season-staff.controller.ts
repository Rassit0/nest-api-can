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
import { TeamSeasonStaffService } from './team-season-staff.service';
import { CreateTeamSeasonStaffDto } from './dto/create-team-season-staff.dto';
import { UpdateTeamSeasonStaffDto } from './dto/update-team-season-staff.dto';
import { TeamSeasonStaffPaginationDto } from './dto/pagination.dto';

@ApiTags('Team Season Staff')
@Controller('team-season-staff')
export class TeamSeasonStaffController {
  constructor(
    private readonly teamSeasonStaffService: TeamSeasonStaffService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Asignar un profesor a una temporada de equipo',
    description:
      'Vincula a un miembro de personal a un equipo y periodo específico.',
  })
  @ApiCreatedResponse({
    description: 'Profesor asignado al equipo exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  create(@Body() createTeamSeasonStaffDto: CreateTeamSeasonStaffDto) {
    return this.teamSeasonStaffService.create(createTeamSeasonStaffDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar profesores de equipos',
    description:
      'Retorna una lista paginada y filtrable de todas las asignaciones de personal a equipos.',
  })
  @ApiOkResponse({ description: 'Lista de profesores obtenida correctamente.' })
  async findAll(@Query() paginationDto: TeamSeasonStaffPaginationDto) {
    return await this.teamSeasonStaffService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener asignación de profesor por ID',
    description:
      'Busca y retorna los detalles de la asignación del profesor al equipo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Asignación encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La asignación no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonStaffService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar asignación de profesor por ID',
    description:
      'Modifica el rol o vigencia de un profesor asignado al equipo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateTeamSeasonStaffDto })
  @ApiOkResponse({ description: 'Asignación actualizada con éxito.' })
  @ApiNotFoundResponse({ description: 'La asignación no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamSeasonStaffDto: UpdateTeamSeasonStaffDto,
  ) {
    return this.teamSeasonStaffService.update(id, updateTeamSeasonStaffDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar asignación de profesor por ID',
    description: 'Desvincula de forma permanente al profesor del equipo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Asignación eliminada con éxito.' })
  @ApiNotFoundResponse({ description: 'La asignación no existe.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamSeasonStaffService.remove(id);
  }
}
