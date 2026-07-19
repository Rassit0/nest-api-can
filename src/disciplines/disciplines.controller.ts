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
import { DisciplinesService } from './disciplines.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { DisciplinePaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { DisciplineResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Disciplines')
@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una disciplina deportiva',
    description:
      'Registra una nueva disciplina (ej: Fútbol, Baloncesto) con su correspondiente ícono representativo.',
  })
  @ApiStandardCreatedResponse(DisciplineResponseDto, 'Disciplina creada exitosamente.')
  async create(@Body() createDisciplineDto: CreateDisciplineDto) {
    return await this.disciplinesService.create(createDisciplineDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar disciplinas',
    description:
      'Retorna una lista paginada y filtrable de todas las disciplinas deportivas.',
  })
  @ApiPaginatedResponse(DisciplineResponseDto, 'Lista de disciplinas obtenida correctamente.')
  async findAll(@Query() paginationDto: DisciplinePaginationDto) {
    return await this.disciplinesService.findAll(paginationDto);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Listar todas las disciplinas (Público)',
    description:
      'Retorna una lista completa sin paginación de todas las disciplinas, ideal para listas desplegables (dropdowns) en el portal web.',
  })
  @ApiStandardResponse(DisciplineResponseDto, 'Disciplinas obtenidas exitosamente.')
  async findAllUnpaginated() {
    return await this.disciplinesService.findAllUnpaginated();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener disciplina por ID',
    description:
      'Retorna los detalles de una disciplina deportiva específica por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la disciplina (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(DisciplineResponseDto, 'Disciplina encontrada exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.disciplinesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar disciplina por ID',
    description:
      'Modifica el nombre o ícono de una disciplina deportiva por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la disciplina a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateDisciplineDto })
  @ApiStandardResponse(DisciplineResponseDto, 'Disciplina actualizada exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDisciplineDto: UpdateDisciplineDto,
  ) {
    return this.disciplinesService.update(id, updateDisciplineDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar disciplina por ID',
    description:
      'Remueve permanentemente una disciplina del catálogo del club.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la disciplina a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(DisciplineResponseDto, 'Disciplina eliminada con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.disciplinesService.remove(id);
  }
}
