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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { PermissionResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo permiso',
    description:
      'Registra un permiso de seguridad en el sistema para asociar a roles.',
  })
  @ApiStandardCreatedResponse(PermissionResponseDto, 'Permiso creado exitosamente.')
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return await this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de permisos',
    description:
      'Retorna una lista paginada y filtrable de permisos de seguridad.',
  })
  @ApiPaginatedResponse(PermissionResponseDto, 'Lista de permisos obtenida correctamente.')
  async findAll(@Query() paginationDto: PermissionsPaginationDto) {
    return await this.permissionsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un permiso por ID',
    description:
      'Busca y retorna los detalles de un permiso de seguridad por su identificador único UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del permiso (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PermissionResponseDto, 'Permiso encontrado y retornado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un permiso específico',
    description:
      'Modifica los campos editables de un permiso existente por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del permiso a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdatePermissionDto })
  @ApiStandardResponse(PermissionResponseDto, 'Permiso actualizado exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return await this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un permiso',
    description: 'Remueve un permiso de seguridad del sistema por su ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del permiso a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(PermissionResponseDto, 'Permiso eliminado exitosamente.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.permissionsService.remove(id);
  }
}
