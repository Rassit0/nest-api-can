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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesPaginationDto } from './dto/pagination.dto';
import { ApiStandardResponse, ApiStandardCreatedResponse, ApiPaginatedResponse } from '../common/decorators/api-responses.decorator';
import { RoleResponseDto } from '../common/dto/responses/entities.dto';

@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo rol y asignarle permisos',
    description:
      'Registra un rol en el sistema y asocia los IDs de los permisos pasados en el cuerpo.',
  })
  @ApiStandardCreatedResponse(RoleResponseDto, 'Rol creado y permisos mapeados con éxito.')
  async create(@Body() createRoleDto: CreateRoleDto) {
    return await this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de roles',
    description:
      'Retorna una lista paginada y filtrable de todos los roles cargados.',
  })
  @ApiPaginatedResponse(RoleResponseDto, 'Lista de roles obtenida correctamente.')
  async findAll(@Query() paginationDto: RolesPaginationDto) {
    return await this.rolesService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un rol por ID',
    description:
      'Busca y retorna los detalles de un rol específico con sus permisos asociados.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del rol a consultar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(RoleResponseDto, 'Rol encontrado exitosamente.')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.rolesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un rol y sus permisos',
    description:
      'Actualiza los metadatos de un rol y rehace la relación de permisos de forma transaccional.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del rol a actualizar (UUID)',
    format: 'uuid',
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiStandardResponse(RoleResponseDto, 'Rol y permisos actualizados exitosamente.')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return await this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un rol',
    description:
      'Remueve un rol del sistema y limpia las relaciones asociadas por cascada.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del rol a eliminar (UUID)',
    format: 'uuid',
  })
  @ApiStandardResponse(RoleResponseDto, 'Rol eliminado con éxito.')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.rolesService.remove(id);
  }
}
