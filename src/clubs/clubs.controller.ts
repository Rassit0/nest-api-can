import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
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
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { ClubsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { ClubResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';

@ApiTags('Clubs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @RequirePermissions('CREATE_CLUBS')
  @ApiOperation({
    summary: 'Crear un club deportivo',
    description:
      'Registra un club en el sistema asignándole una disciplina y vinculándolo a una institución.',
  })
  @ApiStandardCreatedResponse(
    ClubResponseDto,
    'Club deportivo creado con éxito.',
  )
  async create(@Body() createClubDto: CreateClubDto) {
    return await this.clubsService.create(createClubDto);
  }

  @Get()
  @RequirePermissions('READ_CLUBS')
  @ApiOperation({
    summary: 'Listar clubes deportivos',
    description:
      'Retorna una lista paginada y filtrable de todos los clubes del sistema.',
  })
  @ApiPaginatedResponse(
    ClubResponseDto,
    'Lista de clubes obtenida correctamente.',
  )
  async findAll(@Query() paginationDto: ClubsPaginationDto) {
    return await this.clubsService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('READ_CLUBS')
  @ApiOperation({
    summary: 'Obtener club deportivo por ID',
    description:
      'Busca y retorna los metadatos completos de un club por su ID.',
  })
  @ApiParam({ name: 'id', description: 'ID del club (UUID)', format: 'uuid' })
  @ApiStandardResponse(
    ClubResponseDto,
    'Club deportivo encontrado exitosamente.',
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clubsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_CLUBS')
  @ApiOperation({
    summary: 'Actualizar club deportivo por ID',
    description: 'Modifica parámetros configurables de un club por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del club a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateClubDto })
  @ApiStandardResponse(ClubResponseDto, 'Club deportivo actualizado con éxito.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClubDto: UpdateClubDto,
  ) {
    return await this.clubsService.update(id, updateClubDto);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_CLUBS')
  @ApiOperation({
    summary: 'Eliminar club deportivo por ID',
    description:
      'Remueve de forma definitiva un club y sus dependencias asociadas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del club a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    ClubResponseDto,
    'Club deportivo eliminado exitosamente.',
  )
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clubsService.remove(id);
  }

  @Get('all/options')
  @RequirePermissions('READ_CLUBS')
  @ApiOperation({
    summary: 'Obtener opciones de clubes',
    description:
      'Retorna pares de clave-valor (ID y nombre) de todos los clubes para componentes de selección en el frontend.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de clubes obtenida correctamente.',
  })
  async getClubsOptions() {
    return await this.clubsService.getClubsOptions();
  }

  @Get('disciplines/options')
  @RequirePermissions('READ_CLUBS')
  @ApiOperation({
    summary: 'Obtener opciones de disciplinas de clubes',
    description: 'Retorna las disciplinas asociadas a clubes para selectores.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de disciplinas obtenida correctamente.',
  })
  async getDisciplinesOptions() {
    return await this.clubsService.getDisciplinesOptions();
  }

  @Get('organizations/options')
  @RequirePermissions('READ_CLUBS')
  @ApiOperation({
    summary: 'Obtener opciones de instituciones asociadas',
    description: 'Retorna las organizaciones/instituciones para selectores.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de instituciones obtenida correctamente.',
  })
  async getOrganizationsOptions() {
    return await this.clubsService.getOrganizationsOptions();
  }
}
