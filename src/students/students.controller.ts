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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { StudentResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo estudiante',
    description:
      'Crea el perfil de un estudiante a partir de un perfil de persona preexistente.',
  })
  @ApiStandardCreatedResponse(StudentResponseDto, 'Estudiante registrado exitosamente.')
  async create(@Body() createStudentDto: CreateStudentDto) {
    return await this.studentsService.create(createStudentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de estudiantes',
    description:
      'Retorna una lista paginada y filtrable de todos los estudiantes registrados.',
  })
  @ApiPaginatedResponse(StudentResponseDto, 'Lista de estudiantes obtenida correctamente.')
  async findAll(@Query() paginationDto: StudentsPaginationDto) {
    return await this.studentsService.findAll(paginationDto);
  }

  @Get('available-persons-options')
  @ApiOperation({
    summary: 'Listar opciones de personas disponibles',
    description: 'Retorna una lista paginada de personas que aún no son estudiantes.',
  })
  async getAvailablePersons(@Query() paginationDto: import('src/common/dto/pagination').PaginationDto) {
    return await this.studentsService.getAvailablePersons(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un estudiante por ID',
    description:
      'Busca y retorna la información personal completa y de vinculación de un estudiante por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del estudiante a consultar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(StudentResponseDto, 'Estudiante encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un estudiante específico',
    description:
      'Actualiza el estado de actividad o vinculación de persona de un estudiante por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del estudiante a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStudentDto })
  @FormDataRequest()
  @ApiStandardResponse(StudentResponseDto, 'Estudiante actualizado exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return await this.studentsService.update(id, updateStudentDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un estudiante',
    description: 'Elimina de manera permanente la vinculación del estudiante.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del estudiante a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(StudentResponseDto, 'Estudiante eliminado con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentsService.remove(id);
  }
}
