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
import { TeamSeasonStaffService } from './team-season-staff.service';
import { CreateTeamSeasonStaffDto } from './dto/create-team-season-staff.dto';
import { UpdateTeamSeasonStaffDto } from './dto/update-team-season-staff.dto';
import { TeamSeasonStaffPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { TeamSeasonStaffResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Team Season Staff')
@Controller('team-season-staff')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
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
  @ApiStandardCreatedResponse(
    TeamSeasonStaffResponseDto,
    'Profesor asignado al equipo exitosamente.',
  )
  @RequirePermissions('CREATE_TEAM_SEASON_STAFF')
  async create(@Body() createTeamSeasonStaffDto: CreateTeamSeasonStaffDto) {
    return this.teamSeasonStaffService.create(createTeamSeasonStaffDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar profesores de equipos',
    description:
      'Retorna una lista paginada y filtrable de todas las asignaciones de personal a equipos.',
  })
  @ApiPaginatedResponse(
    TeamSeasonStaffResponseDto,
    'Lista de profesores obtenida correctamente.',
  )
  @RequirePermissions('READ_TEAM_SEASON_STAFF')
  async findAll(@Query() paginationDto: TeamSeasonStaffPaginationDto) {
    return await this.teamSeasonStaffService.findAll(paginationDto);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Listar opciones de personal disponible',
    description:
      'Retorna una lista paginada de personal que no está asignado a la temporada de equipo especificada.',
  })
  @RequirePermissions('READ_TEAM_SEASON_STAFF')
  async getAvailableStaff(
    @Query() paginationDto: TeamSeasonStaffPaginationDto,
  ) {
    return await this.teamSeasonStaffService.getAvailableStaff(paginationDto);
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
  @ApiStandardResponse(
    TeamSeasonStaffResponseDto,
    'Asignación encontrada exitosamente.',
  )
  @RequirePermissions('READ_TEAM_SEASON_STAFF')
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
  @ApiStandardResponse(
    TeamSeasonStaffResponseDto,
    'Asignación actualizada con éxito.',
  )
  @RequirePermissions('UPDATE_TEAM_SEASON_STAFF')
  async update(
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
  @ApiStandardResponse(
    TeamSeasonStaffResponseDto,
    'Asignación eliminada con éxito.',
  )
  @RequirePermissions('DELETE_TEAM_SEASON_STAFF')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamSeasonStaffService.remove(id);
  }
}
