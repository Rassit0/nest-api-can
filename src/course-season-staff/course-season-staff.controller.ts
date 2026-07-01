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
import { CourseSeasonStaffService } from './course-season-staff.service';
import { CreateCourseSeasonStaffDto } from './dto/create-course-season-staff.dto';
import { UpdateCourseSeasonStaffDto } from './dto/update-course-season-staff.dto';
import { CourseSeasonStaffPaginationDto } from './dto/pagination.dto';

@ApiTags('Course Season Staff')
@Controller('course-season-staff')
export class CourseSeasonStaffController {
  constructor(
    private readonly courseSeasonStaffService: CourseSeasonStaffService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Asignar un miembro del personal a un curso escolar',
    description:
      'Vincula a un entrenador/auxiliar a una instancia de curso escolar con un rol específico. Si se marca como encargado principal, se removerá esa distinción de los otros profesores del curso.',
  })
  @ApiCreatedResponse({
    description: 'Miembro del personal asignado exitosamente.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos.' })
  async create(@Body() createCourseSeasonStaffDto: CreateCourseSeasonStaffDto) {
    return await this.courseSeasonStaffService.create(
      createCourseSeasonStaffDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de personal asignado a cursos escolares',
    description:
      'Retorna una lista paginada y filtrable de todas las asignaciones de profesores vigentes o históricas.',
  })
  @ApiOkResponse({
    description: 'Lista de asignaciones escolares obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: CourseSeasonStaffPaginationDto) {
    return await this.courseSeasonStaffService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una asignación de personal por ID',
    description:
      'Retorna los detalles completos de una asignación del personal a un curso escolar en particular.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación a consultar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Asignación encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La asignación solicitada no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.courseSeasonStaffService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar rol o detalles de la asignación del personal',
    description:
      'Modifica el rol, fechas de vigencia o notas de la asignación del profesor por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateCourseSeasonStaffDto })
  @ApiOkResponse({ description: 'Asignación actualizada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La asignación solicitada no existe.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCourseSeasonStaffDto: UpdateCourseSeasonStaffDto,
  ) {
    return await this.courseSeasonStaffService.update(
      id,
      updateCourseSeasonStaffDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remover al miembro del personal de la temporada del curso',
    description:
      'Remueve permanentemente al profesor de la asignación del curso escolar.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la asignación a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Profesor removido del curso con éxito.' })
  @ApiNotFoundResponse({ description: 'La asignación solicitada no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.courseSeasonStaffService.remove(id);
  }
}
