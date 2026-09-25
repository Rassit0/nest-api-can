import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { InstitutionHistoryService } from './institution-history.service';
import { UpdateInstitutionHistorySettingsDto } from './dto/update-settings.dto';
import { CreateInstitutionHistoryItemDto } from './dto/create-item.dto';
import { UpdateInstitutionHistoryItemDto } from './dto/update-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
  }
  cb(null, true);
};

@ApiTags('Institution History (Admin)')
@Controller('institution-history')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class InstitutionHistoryController {
  constructor(private readonly historyService: InstitutionHistoryService) {}

  // --- SETTINGS ---
  @Get('settings')
  @ApiOperation({ summary: 'Obtener configuración de Historia Institucional' })
  @RequirePermissions('READ_INSTITUTION_HISTORY')
  getSettings() {
    return this.historyService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Actualizar configuración de Historia Institucional' })
  @RequirePermissions('UPDATE_INSTITUTION_HISTORY')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  updateSettings(
    @Body() dto: UpdateInstitutionHistorySettingsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.historyService.updateSettings(dto, file);
  }

  // --- ITEMS ---
  @Get('items')
  @ApiOperation({ summary: 'Listar hitos del timeline (Admin)' })
  @RequirePermissions('READ_INSTITUTION_HISTORY')
  getItems() {
    return this.historyService.getItems(false);
  }

  @Post('items')
  @ApiOperation({ summary: 'Crear un nuevo hito en el timeline' })
  @RequirePermissions('CREATE_INSTITUTION_HISTORY')
  createItem(@Body() dto: CreateInstitutionHistoryItemDto) {
    return this.historyService.createItem(dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Actualizar un hito existente' })
  @RequirePermissions('UPDATE_INSTITUTION_HISTORY')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstitutionHistoryItemDto,
  ) {
    return this.historyService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Eliminar un hito del timeline' })
  @RequirePermissions('DELETE_INSTITUTION_HISTORY')
  deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.historyService.deleteItem(id);
  }
}
