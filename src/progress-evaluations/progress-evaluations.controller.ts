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
import { ProgressEvaluationsService } from './progress-evaluations.service';
import { CreateProgressEvaluationDto } from './dto/create-progress-evaluation.dto';
import { UpdateProgressEvaluationDto } from './dto/update-progress-evaluation.dto';
import { ProgressEvaluationsPaginationDto } from './dto/pagination.dto';

@ApiTags('Progress Evaluations')
@Controller('progress-evaluations')
export class ProgressEvaluationsController {
  constructor(
    private readonly progressEvaluationsService: ProgressEvaluationsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar una evaluación de progreso de jugador o estudiante',
    description:
      'Registra un reporte periódico de aptitud (técnica, táctica, física, conductual) para un jugador del club o estudiante de las escuelas.',
  })
  @ApiCreatedResponse({
    description: 'Evaluación de progreso registrada exitosamente.',
  })
  @ApiBadRequestResponse({
    description:
      'Datos de entrada inválidos (debe proporcionar al menos un playerId o studentId).',
  })
  async create(
    @Body() createProgressEvaluationDto: CreateProgressEvaluationDto,
  ) {
    return await this.progressEvaluationsService.create(
      createProgressEvaluationDto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de evaluaciones de progreso',
    description:
      'Retorna una lista paginada y filtrable de todos los reportes de progreso registrados.',
  })
  @ApiOkResponse({
    description: 'Lista de evaluaciones obtenida correctamente.',
  })
  async findAll(@Query() paginationDto: ProgressEvaluationsPaginationDto) {
    return await this.progressEvaluationsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una evaluación de progreso por ID',
    description:
      'Busca y retorna las notas y puntajes de una evaluación de progreso específica por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la evaluación (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Evaluación encontrada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La evaluación solicitada no existe.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.progressEvaluationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar notas o puntajes de una evaluación',
    description:
      'Modifica los puntajes o notas cualitativas de una evaluación disciplinaria por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la evaluación a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateProgressEvaluationDto })
  @ApiOkResponse({
    description: 'Evaluación de progreso actualizada con éxito.',
  })
  @ApiNotFoundResponse({ description: 'La evaluación solicitada no existe.' })
  @ApiBadRequestResponse({ description: 'Datos incorrectos.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProgressEvaluationDto: UpdateProgressEvaluationDto,
  ) {
    return await this.progressEvaluationsService.update(
      id,
      updateProgressEvaluationDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una evaluación',
    description:
      'Remueve de manera permanente el registro de evaluación del historial.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la evaluación a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiOkResponse({ description: 'Evaluación eliminada exitosamente.' })
  @ApiNotFoundResponse({ description: 'La evaluación solicitada no existe.' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.progressEvaluationsService.remove(id);
  }
}
