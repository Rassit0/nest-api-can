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
import { CourseSeasonsService } from './course-seasons.service';
import { CreateCourseSeasonDto } from './dto/create-course-season.dto';
import { UpdateCourseSeasonDto } from './dto/update-course-season.dto';
import { CourseSeasonsPaginationDto } from './dto/pagination.dto';

@ApiTags('Course Seasons')
@Controller('course-seasons')
export class CourseSeasonsController {
  constructor(private readonly courseSeasonsService: CourseSeasonsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear/instanciar un periodo para un curso',
    description:
      'Instancia un curso en una temporada específica configurando las tarifas comerciales (mensualidad, matrícula) y el control de mora.',
  })
  @ApiCreatedResponse({
    description: 'Periodo de curso escolar creado y configurado exitosamente.',
  })
  @ApiBadRequestResponse({
    description:
      'Datos de entrada inválidos o colisión de configuración única.',
  })
  async create(@Body() createCourseSeasonDto: CreateCourseSeasonDto) {
    return await this.courseSeasonsService.create(createCourseSeasonDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de periodos de cursos',
    description:
      'Retorna una lista paginada y filtrable de todos los cursos instanciados en temporadas.',
  })
  @ApiOkResponse({
    description: 'Lista de periodos de cursos obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: CourseSeasonsPaginationDto) {
    return await this.courseSeasonsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de un periodo de curso por ID',
    description:
      'Busca y retorna la información parametrizada completa de un curso en una temporada por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del periodo del curso a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Periodo de curso encontrado y retornado exitosamente.',
  })
  @ApiNotFoundResponse({
    description: 'El periodo de curso solicitado no existe.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.courseSeasonsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar configuración de un periodo de curso específico',
    description:
      'Modifica parámetros comerciales o de cupos para un curso instanciado por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del periodo del curso a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateCourseSeasonDto })
  @ApiOkResponse({
    description: 'Configuración de periodo de curso actualizada exitosamente.',
  })
  @ApiNotFoundResponse({
    description: 'El periodo de curso solicitado no existe.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCourseSeasonDto: UpdateCourseSeasonDto,
  ) {
    return await this.courseSeasonsService.update(id, updateCourseSeasonDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un periodo de curso',
    description: 'Remueve permanentemente el curso de la temporada asignada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del periodo de curso a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Periodo de curso eliminado con éxito.' })
  @ApiNotFoundResponse({
    description: 'El periodo de curso solicitado no existe.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.courseSeasonsService.remove(id);
  }
}
