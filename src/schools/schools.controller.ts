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
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { SchoolResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva escuela',
    description:
      'Registra una escuela de formación asociada a una institución y una disciplina deportiva.',
  })
  @ApiStandardCreatedResponse(SchoolResponseDto, 'Escuela creada exitosamente.')
  async create(@Body() createSchoolDto: CreateSchoolDto) {
    return await this.schoolsService.create(createSchoolDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de escuelas',
    description:
      'Retorna una lista paginada y filtrable de todas las escuelas registradas.',
  })
  @ApiPaginatedResponse(SchoolResponseDto, 'Lista de escuelas obtenida correctamente.')
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
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.schoolsService.remove(id);
  }
}
