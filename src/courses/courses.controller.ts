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
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { CourseResponseDto } from '../common/dto/responses/entities.dto';

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
  @ApiStandardCreatedResponse(
    CourseResponseDto,
    'Curso escolar creado exitosamente.',
  )
  async create(@Body() createCourseDto: CreateCourseDto) {
    return await this.coursesService.create(createCourseDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de cursos',
    description:
      'Retorna una lista paginada y filtrable de todos los cursos cargados.',
  })
  @ApiPaginatedResponse(
    CourseResponseDto,
    'Lista de cursos obtenida correctamente.',
  )
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
  @ApiStandardResponse(CourseResponseDto, 'Curso encontrado exitosamente.')
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
  @ApiStandardResponse(CourseResponseDto, 'Curso actualizado exitosamente.')
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
  @ApiStandardResponse(CourseResponseDto, 'Curso eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.coursesService.remove(id);
  }

  @Get('schools-by-discipline/options/:disciplineId')
  @ApiOperation({
    summary: 'Obtener escuelas por disciplina',
    description:
      'Retorna las escuelas asociadas a una disciplina deportiva específica.',
  })
  @ApiParam({
    name: 'disciplineId',
    description: 'ID de la disciplina (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Opciones de clubes obtenidas correctamente.' })
  async getSchoolsByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.coursesService.getSchoolsByDisciplineOptions(
      disciplineId,
    );
  }

  @Get('disciplines/options')
  @ApiOperation({
    summary: 'Obtener disciplinas disponibles',
    description: 'Retorna selectores de disciplinas deportivas.',
  })
  @ApiOkResponse({
    description: 'Opciones de disciplinas obtenidas correctamente.',
  })
  async getDisciplinesOptions() {
    return await this.coursesService.getDisciplinesOptions();
  }
}
