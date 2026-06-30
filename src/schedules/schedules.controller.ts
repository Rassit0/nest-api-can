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
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesPaginationDto } from './dto/pagination.dto';

@ApiTags('Schedules')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Programar un nuevo horario de entrenamiento' })
  async create(@Body() createScheduleDto: CreateScheduleDto) {
    return await this.schedulesService.create(createScheduleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de horarios paginada y filtrada' })
  async findAll(@Query() paginationDto: SchedulesPaginationDto) {
    return await this.schedulesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un horario específico por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.schedulesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un horario específico' })
  @ApiBody({ type: UpdateScheduleDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return await this.schedulesService.update(id, updateScheduleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un horario de la programación' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.schedulesService.remove(id);
  }
}
