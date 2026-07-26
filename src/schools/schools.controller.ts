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
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { SchoolResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Schools')
@Controller('schools')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva escuela',
    description:
      'Registra una escuela de formación asociada a una institución y una disciplina deportiva.',
  })
  @ApiStandardCreatedResponse(SchoolResponseDto, 'Escuela creada exitosamente.')
  @RequirePermissions('CREATE_SCHOOLS')
  async create(@Body() createSchoolDto: CreateSchoolDto) {
    return await this.schoolsService.create(createSchoolDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de escuelas',
    description:
      'Retorna una lista paginada y filtrable de todas las escuelas registradas.',
  })
  @ApiPaginatedResponse(
    SchoolResponseDto,
    'Lista de escuelas obtenida correctamente.',
  )
  @RequirePermissions('READ_SCHOOLS')
  async findAll(@Query() paginationDto: SchoolsPaginationDto) {
    return await this.schoolsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una escuela por ID',
    description:
      'Busca y retorna los metadatos de una escuela específica junto a su institución y disciplina deportiva.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la escuela a consultar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SchoolResponseDto, 'Escuela encontrada exitosamente.')
  @RequirePermissions('READ_SCHOOLS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.schoolsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una escuela específica',
    description:
      'Modifica los campos editables (nombre, institución o disciplina) de una escuela por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la escuela a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateSchoolDto })
  @ApiStandardResponse(SchoolResponseDto, 'Escuela actualizada exitosamente.')
  @RequirePermissions('UPDATE_SCHOOLS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ) {
    return await this.schoolsService.update(id, updateSchoolDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una escuela',
    description:
      'Elimina de manera permanente la escuela de formación deportiva.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la escuela a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(SchoolResponseDto, 'Escuela eliminada exitosamente.')
  @RequirePermissions('DELETE_SCHOOLS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.schoolsService.remove(id);
  }

  @Get('all/options')
  @ApiOperation({
    summary: 'Obtener opciones de escuelas',
    description:
      'Retorna pares de clave-valor (ID y nombre) de todas las escuelas para componentes de selección en el frontend.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de escuelas obtenida correctamente.',
  })
  @RequirePermissions('READ_SCHOOLS')
  async getSchoolsOptions() {
    return await this.schoolsService.getSchoolsOptions();
  }

  @Get('disciplines/options')
  @ApiOperation({
    summary: 'Obtener opciones de disciplinas de escuelas',
    description:
      'Retorna las disciplinas asociadas a escuelas para selectores.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de disciplinas obtenida correctamente.',
  })
  @RequirePermissions('READ_SCHOOLS')
  async getDisciplinesOptions() {
    return await this.schoolsService.getDisciplinesOptions();
  }

  @Get('organizations/options')
  @ApiOperation({
    summary: 'Obtener opciones de instituciones asociadas',
    description: 'Retorna las organizaciones/instituciones para selectores.',
  })
  @ApiOkResponse({
    description: 'Lista de opciones de instituciones obtenida correctamente.',
  })
  @RequirePermissions('READ_SCHOOLS')
  async getOrganizationsOptions() {
    return await this.schoolsService.getOrganizationsOptions();
  }
}
