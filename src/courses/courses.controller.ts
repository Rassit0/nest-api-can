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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CoursesPaginationDto } from './dto/pagination.dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo curso',
    description:
      'Registra un curso académico en el sistema asignándole una escuela deportiva.',
  })
  @ApiCreatedResponse({ description: 'Curso escolar creado exitosamente.' })
  @ApiBadRequestResponse({
    description:
      'Datos de entrada inválidos o curso duplicado en la misma escuela.',
  })
  async create(@Body() createCourseDto: CreateCourseDto) {
    return await this.coursesService.create(createCourseDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de cursos',
    description:
      'Retorna una lista paginada y filtrable de todos los cursos cargados.',
  })
  @ApiOkResponse({ description: 'Lista de cursos obtenida correctamente.' })
  async findAll(@Query() paginationDto: CoursesPaginationDto) {
    return await this.coursesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un curso por ID',
    description:
      'Busca y retorna los metadatos de un curso específico junto con su escuela e institución asociadas.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del curso a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Curso encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El curso solicitado no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.coursesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un curso específico',
    description:
      'Modifica detalles (nombre, descripción, imagen, escuela) de un curso por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del curso a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateCourseDto })
  @ApiOkResponse({ description: 'Curso actualizado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El curso solicitado no existe.' })
  @ApiBadRequestResponse({
    description: 'Datos incorrectos o duplicados con otro curso de la escuela.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCourseDto: UpdateCourseDto,
  ) {
    return await this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un curso',
    description: 'Elimina de manera permanente un curso del catálogo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del curso a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Curso eliminado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El curso solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.coursesService.remove(id);
  }
}
