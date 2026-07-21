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
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { StaffResponseDto } from '../common/dto/responses/entities.dto';
import { PaginationDto } from 'src/common/dto/pagination';

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un miembro del personal',
    description:
      'Crea la vinculación de personal (entrenador, auxiliar, etc.) a partir de un perfil de persona preexistente.',
  })
  @ApiStandardCreatedResponse(
    StaffResponseDto,
    'Miembro del personal registrado exitosamente.',
  )
  async create(@Body() createStaffDto: CreateStaffDto) {
    return await this.staffService.create(createStaffDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar miembros del personal',
    description:
      'Retorna una lista paginada y filtrable de todos los entrenadores/auxiliares.',
  })
  @ApiPaginatedResponse(
    StaffResponseDto,
    'Lista del personal obtenida correctamente.',
  )
  async findAll(@Query() paginationDto: StaffPaginationDto) {
    return this.staffService.findAll(paginationDto);
  }

  @Get('persons/available')
  @ApiOperation({
    summary: 'Listar opciones de personal disponible',
    description:
      'Retorna una lista paginada de personas que no están registradas como staff.',
  })
  async getAvailablePersons(@Query() paginationDto: PaginationDto) {
    return this.staffService.getAvailablePersons(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener personal por ID',
    description:
      'Retorna los datos completos de perfil y vinculación del personal por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal encontrado exitosamente.',
  )
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar personal por ID',
    description: 'Modifica datos de ficha o vigencia del personal por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateStaffDto })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal actualizado exitosamente.',
  )
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    return await this.staffService.update(id, updateStaffDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar personal por ID',
    description: 'Remueve de forma definitiva el registro de personal.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del personal a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(
    StaffResponseDto,
    'Miembro del personal eliminado exitosamente.',
  )
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.remove(id);
  }
}
