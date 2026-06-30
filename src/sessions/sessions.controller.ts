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
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsPaginationDto } from './dto/pagination.dto';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Programar una nueva sesión de entrenamiento' })
  async create(@Body() createSessionDto: CreateSessionDto) {
    return await this.sessionsService.create(createSessionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de sesiones de entrenamiento' })
  async findAll(@Query() paginationDto: SessionsPaginationDto) {
    return await this.sessionsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una sesión por ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sesión específica' })
  @ApiBody({ type: UpdateSessionDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    return await this.sessionsService.update(id, updateSessionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sesión de entrenamiento' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionsService.remove(id);
  }
}
