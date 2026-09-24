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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { UpdateAvatarDto } from '../persons/dto/update-avatar.dto';
import {
  ApiStandardResponse,
  ApiStandardCreatedResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { UserResponseDto, CurrentPersonDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Registrar un nuevo usuario',
    description:
      'Crea las credenciales de acceso para un correo asignando un rol y vinculando opcionalmente un perfil de persona.',
  })
  @ApiStandardCreatedResponse(
    UserResponseDto,
    'Usuario creado exitosamente. Retorna la contraseña temporal en data.tempPassword.',
  )
  @RequirePermissions('CREATE_USERS')
  async create(@Body() createUserDto: CreateUserDto, @Req() req: any) {
    return await this.usersService.create(createUserDto, req.user);
  }


  @Get()
  @ApiOperation({
    summary: 'Obtener lista de usuarios',
    description:
      'Retorna una lista paginada y filtrable de todos los usuarios registrados en la plataforma.',
  })
  @ApiPaginatedResponse(
    UserResponseDto,
    'Lista de usuarios obtenida correctamente.',
  )
  @RequirePermissions('READ_USERS')
  async findAll(@Query() paginationDto: UsersPaginationDto) {
    return await this.usersService.findAll(paginationDto);
  }

  @Get('me/profile')
  @ApiOperation({
    summary: 'Obtener el perfil del usuario autenticado',
    description: 'Retorna la proyección mínima de la persona asociada al usuario autenticado. No requiere permiso administrativo.',
  })
  @ApiStandardResponse(CurrentPersonDto, 'Perfil obtenido exitosamente.')
  // Note: NO @RequirePermissions here! Self-authorized.
  async findMyProfile(@Req() req: any) {
    return await this.usersService.findMyProfile(req.user.id);
  }

  @Get('me/detailed-profile')
  @ApiOperation({
    summary: 'Obtener el perfil detallado del usuario autenticado (Self-Service)',
    description: 'Retorna información detallada de solo lectura para la página de Mi Perfil.',
  })
  async findMyDetailedProfile(@Req() req: any) {
    return await this.usersService.findMyDetailedProfile(req.user.id);
  }

  @Patch('me/avatar')
  @ApiOperation({
    summary: 'Actualizar avatar del usuario autenticado (Self-Service)',
    description: 'Actualiza la foto de perfil de la persona asociada al usuario actual.',
  })
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  // Note: NO @RequirePermissions. Self-authorized via jwt.
  async updateSelfAvatar(@Req() req: any, @Body() updateAvatarDto: UpdateAvatarDto) {
    return await this.usersService.updateSelfAvatar(req.user.id, updateAvatarDto.file);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un usuario por ID',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardResponse(UserResponseDto, 'Usuario encontrado exitosamente.')
  @RequirePermissions('READ_USERS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un usuario específico',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateUserDto })
  @ApiStandardResponse(UserResponseDto, 'Usuario actualizado exitosamente.')
  @RequirePermissions('UPDATE_USERS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ) {
    return await this.usersService.update(id, updateUserDto, req.user);
  }

  @Patch(':id/reset-password')
  @ApiOperation({
    summary: 'Restablecer contraseña',
    description: 'Genera una nueva contraseña temporal para el usuario y la retorna',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardResponse(UserResponseDto, 'Contraseña restablecida exitosamente.')
  @RequirePermissions('UPDATE_USERS')
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.usersService.resetPassword(id, req.user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar un usuario',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardResponse(UserResponseDto, 'Usuario desactivado exitosamente.')
  @RequirePermissions('DEACTIVATE_USERS')
  async deactivate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.usersService.deactivate(id, req.user);
  }

  @Patch(':id/reactivate')
  @ApiOperation({
    summary: 'Reactivar un usuario',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardResponse(UserResponseDto, 'Usuario reactivado exitosamente.')
  @RequirePermissions('DEACTIVATE_USERS')
  async reactivate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return await this.usersService.reactivate(id, req.user);
  }

  @Patch(':id/unlock')
  @ApiOperation({
    summary: 'Desbloquear cuenta de usuario',
    description: 'Restablece los intentos fallidos a 0 y elimina el bloqueo temporal de la cuenta.'
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardResponse(UserResponseDto, 'Cuenta desbloqueada exitosamente.')
  @RequirePermissions('UNLOCK_USERS')
  async unlock(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.unlock(id);
  }
}
