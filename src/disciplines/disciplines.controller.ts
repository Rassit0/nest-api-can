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
  @ApiCreatedResponse({ description: 'Disciplina creada exitosamente.' })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createDisciplineDto: CreateDisciplineDto) {
    return await this.disciplinesService.create(createDisciplineDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar disciplinas',
    description:
      'Retorna una lista paginada y filtrable de todas las disciplinas deportivas.',
  })
  @ApiOkResponse({
    description: 'Lista de disciplinas obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: DisciplinePaginationDto) {
    return await this.disciplinesService.findAll(paginationDto);
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
  @ApiOkResponse({ description: 'Disciplina encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La disciplina no existe.' })
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
  @ApiOkResponse({ description: 'Disciplina actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La disciplina no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
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
  @ApiOkResponse({ description: 'Disciplina eliminada con éxito.' })
  @ApiNotFoundResponse({ description: 'La disciplina no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.disciplinesService.remove(id);
  }
}
