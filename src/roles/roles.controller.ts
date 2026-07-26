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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import {
  PermissionsPaginationDto,
  RolesPaginationDto,
} from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import {
  RoleResponseDto,
  PermissionResponseDto,
} from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Roles')
@Controller('roles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo rol y asignarle permisos',
    description:
      'Registra un rol en el sistema y asocia los IDs de los permisos pasados en el cuerpo.',
  })
  @ApiStandardCreatedResponse(
    RoleResponseDto,
    'Rol creado y permisos mapeados con éxito.',
  )
  @RequirePermissions('CREATE_ROLES')
  async create(@Body() createRoleDto: CreateRoleDto) {
    return await this.rolesService.create(createRoleDto);
  }

  @Get('permissions/array')
  @ApiOperation({
    summary: 'Obtener lista de permisos en formato de array por rol',
    description:
      'Retorna todos los permisos del sistema asociados a un rol específico en formato de array. Opcionalmente puede filtrarse por módulo.',
  })
  @ApiQuery({
    name: 'roleId',
    required: true,
    description: 'ID del rol para buscar permisos (UUID)',
    type: String,
  })
  @ApiQuery({
    name: 'moduleName',
    required: false,
    description: 'Nombre del módulo para filtrar permisos (ej. USERS)',
    type: String,
  })
  @ApiOkResponse({
    description: 'Array de nombres de permisos obtenidos exitosamente.',
    type: [String],
  })
  // @RequirePermissions('READ_ROLES')
  async getAllPermissions(
    @Query('roleId', ParseUUIDPipe) roleId: string,
    @Query('moduleName') moduleName?: string,
  ) {
    return await this.rolesService.getPermissionsArray(roleId, moduleName);
  }

  @Get('permissions')
  @ApiOperation({
    summary: 'Obtener lista de permisos paginada',
    description:
      'Retorna los permisos de forma paginada. Opcionalmente filtrable por roleId.',
  })
  @ApiPaginatedResponse(
    PermissionResponseDto,
    'Lista de permisos obtenida correctamente.',
  )
  @RequirePermissions('READ_ROLES')
  async getPermissionsPaginated(
    @Query() paginationDto: PermissionsPaginationDto,
  ) {
    return await this.rolesService.getPermissionsPaginated(paginationDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de roles',
    description:
      'Retorna una lista paginada y filtrable de todos los roles cargados.',
  })
  @ApiPaginatedResponse(
    RoleResponseDto,
    'Lista de roles obtenida correctamente.',
  )
  @RequirePermissions('READ_ROLES')
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
  @RequirePermissions('READ_ROLES')
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
  @ApiStandardResponse(
    RoleResponseDto,
    'Rol y permisos actualizados exitosamente.',
  )
  @RequirePermissions('UPDATE_ROLES')
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
  @RequirePermissions('DELETE_ROLES')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.rolesService.remove(id);
  }
}
