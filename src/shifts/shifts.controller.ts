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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { ShiftResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un turno',
    description:
      'Registra un nuevo turno (ej: Mañana, Tarde, Noche) asociado a una institución.',
  })
  @ApiStandardCreatedResponse(ShiftResponseDto, 'Turno creado con éxito.')
  @RequirePermissions('CREATE_SHIFTS')
  async create(@Body() createShiftDto: CreateShiftDto) {
    return await this.shiftsService.create(createShiftDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar turnos',
    description: 'Retorna una lista paginada y filtrable de todos los turnos.',
  })
  @ApiPaginatedResponse(
    ShiftResponseDto,
    'Lista de turnos obtenida correctamente.',
  )
  @RequirePermissions('READ_SHIFTS')
  async findAll(@Query() paginationDto: ShiftsPaginationDto) {
    return await this.shiftsService.findAll(paginationDto);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Listar todos los turnos (sin paginar)',
    description:
      'Retorna una lista completa sin paginación de todos los turnos, ideal para listas desplegables (dropdowns).',
  })
  @ApiStandardResponse(ShiftResponseDto, 'Turnos obtenidos exitosamente.')
  @RequirePermissions('READ_SHIFTS')
  async findAllUnpaginated() {
    return await this.shiftsService.findAllUnpaginated();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener turno por ID',
    description: 'Busca y retorna los metadatos completos de un turno.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del turno (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ShiftResponseDto, 'Turno encontrado exitosamente.')
  @RequirePermissions('READ_SHIFTS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.shiftsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar turno por ID',
    description: 'Modifica el nombre o institución de un turno.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del turno a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateShiftDto })
  @ApiStandardResponse(ShiftResponseDto, 'Turno actualizado con éxito.')
  @RequirePermissions('UPDATE_SHIFTS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateShiftDto: UpdateShiftDto,
  ) {
    return await this.shiftsService.update(id, updateShiftDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar turno por ID',
    description: 'Remueve de forma permanente un turno.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del turno a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(ShiftResponseDto, 'Turno eliminado con éxito.')
  @RequirePermissions('DELETE_SHIFTS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.shiftsService.remove(id);
  }
}
