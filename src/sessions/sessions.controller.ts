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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { SessionsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { SessionResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Sessions')
@Controller('sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Programar una nueva sesión de entrenamiento' })
  @RequirePermissions('CREATE_SESSIONS')
  async create(@Body() createSessionDto: CreateSessionDto) {
    return await this.sessionsService.create(createSessionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener lista de sesiones de entrenamiento' })
  @RequirePermissions('READ_SESSIONS')
  async findAll(@Query() paginationDto: SessionsPaginationDto) {
    return await this.sessionsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una sesión por ID' })
  @RequirePermissions('READ_SESSIONS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una sesión específica' })
  @ApiBody({ type: UpdateSessionDto })
  @RequirePermissions('UPDATE_SESSIONS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSessionDto: UpdateSessionDto,
  ) {
    return await this.sessionsService.update(id, updateSessionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una sesión de entrenamiento' })
  @RequirePermissions('DELETE_SESSIONS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionsService.remove(id);
  }
}
