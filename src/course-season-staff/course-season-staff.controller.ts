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
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { CourseSeasonStaffResponseDto } from '../common/dto/responses/entities.dto';

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
  @ApiStandardCreatedResponse(CourseSeasonStaffResponseDto, 'Miembro del personal asignado exitosamente.')
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
  @ApiPaginatedResponse(CourseSeasonStaffResponseDto, 'Lista de asignaciones escolares obtenida correctamente.')
  async findAll(@Query() paginationDto: CourseSeasonStaffPaginationDto) {
    return await this.courseSeasonStaffService.findAll(paginationDto);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Listar opciones de personal disponible',
    description: 'Retorna una lista paginada de personal que no está asignado al curso escolar especificado.',
  })
  async getAvailableStaff(@Query() paginationDto: CourseSeasonStaffPaginationDto) {
    return await this.courseSeasonStaffService.getAvailableStaff(paginationDto);
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
  @ApiStandardResponse(CourseSeasonStaffResponseDto, 'Asignación encontrada exitosamente.')
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
  @ApiStandardResponse(CourseSeasonStaffResponseDto, 'Asignación actualizada exitosamente.')
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
  @ApiStandardResponse(CourseSeasonStaffResponseDto, 'Profesor removido del curso con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.courseSeasonStaffService.remove(id);
  }
}
