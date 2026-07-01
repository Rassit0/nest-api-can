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
  @ApiCreatedResponse({ description: 'Estudiante registrado exitosamente.' })
  @ApiBadRequestResponse({
    description:
      'Datos de entrada inválidos o estudiante ya registrado para esa persona.',
  })
  async create(@Body() createStudentDto: CreateStudentDto) {
    return await this.studentsService.create(createStudentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de estudiantes',
    description:
      'Retorna una lista paginada y filtrable de todos los estudiantes registrados.',
  })
  @ApiOkResponse({
    description: 'Lista de estudiantes obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: StudentsPaginationDto) {
    return await this.studentsService.findAll(paginationDto);
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
  @ApiOkResponse({ description: 'Estudiante encontrado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El estudiante solicitado no existe.' })
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
  @ApiOkResponse({ description: 'Estudiante actualizado exitosamente.' })
  @ApiNotFoundResponse({ description: 'El estudiante solicitado no existe.' })
  @ApiBadRequestResponse({ description: 'Datos inválidos.' })
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
  @ApiOkResponse({ description: 'Estudiante eliminado con éxito.' })
  @ApiNotFoundResponse({ description: 'El estudiante solicitado no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.studentsService.remove(id);
  }
}
