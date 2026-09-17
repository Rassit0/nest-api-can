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
  Req,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsPaginationDto } from './dto/pagination.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
  }
  cb(null, true);
};
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { TeamResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @RequirePermissions('CREATE_TEAMS')
  @ApiOperation({
    summary: 'Crear un equipo deportivo',
    description:
      'Registra un equipo (club, género, etc.) con su logo y metadatos.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  @ApiStandardCreatedResponse(TeamResponseDto, 'Equipo creado exitosamente.')
  async create(
    @Body() createTeamDto: CreateTeamDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.teamsService.create(createTeamDto, image);
  }

  @Get()
  @RequirePermissions('READ_TEAMS')
  @ApiOperation({
    summary: 'Listar equipos',
    description:
      'Retorna una lista paginada y filtrable de todos los equipos del sistema.',
  })
  @ApiPaginatedResponse(
    TeamResponseDto,
    'Lista de equipos obtenida correctamente.',
  )
  async findAll(@Query() paginationDto: TeamsPaginationDto) {
    return this.teamsService.findAll(paginationDto);
  }



  @Get('clubs-by-discipline/options/:disciplineId')
  @RequirePermissions('READ_TEAMS')
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
  @RequirePermissions('READ_TEAMS')
  @ApiOperation({
    summary: 'Obtener disciplinas disponibles para equipos',
  })
  @ApiOkResponse({
    description: 'Opciones de disciplinas obtenidas correctamente.',
  })
  async getDisciplinesOptions() {
    return await this.teamsService.getDisciplinesOptions();
  }

  @Get('options')
  @RequirePermissions('READ_TEAMS')
  @ApiOperation({
    summary: 'Obtener todos los equipos (CAN y externos)',
  })
  @ApiOkResponse({
    description: 'Opciones de equipos obtenidas correctamente.',
  })
  async getTeamsOptions() {
    return await this.teamsService.getTeamsOptions();
  }

  @Get('clubs/context/:clubId')
  @RequirePermissions('READ_TEAMS')
  @ApiOperation({
    summary: 'Obtener contexto básico del club',
    description:
      'Retorna información básica (nombre, id) de un club para usar de contexto en la vista de equipos, ' +
      'sin requerir permisos sobre el módulo de Clubes.',
  })
  @ApiParam({
    name: 'clubId',
    description: 'ID del club (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Contexto del club obtenido correctamente.' })
  async getClubContext(@Param('clubId', ParseUUIDPipe) clubId: string) {
    return await this.teamsService.getClubContext(clubId);
  }

  @Get(':id')
  @RequirePermissions('READ_TEAMS')
  @ApiOperation({
    summary: 'Obtener equipo por ID',
    description:
      'Busca y retorna los metadatos completos de un equipo por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del equipo (UUID)', format: 'uuid' })
  @ApiStandardResponse(TeamResponseDto, 'Equipo encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_TEAMS')
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
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  @ApiBody({ type: UpdateTeamDto })
  @ApiStandardResponse(TeamResponseDto, 'Equipo actualizado exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.teamsService.update(id, updateTeamDto, image);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_TEAMS')
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
  @ApiStandardResponse(TeamResponseDto, 'Equipo eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.remove(id);
  }
}
