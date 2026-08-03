import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Storage')
@Controller('storage')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Subir archivos temporalmente',
    description: 'Sube hasta 5 archivos. Los archivos quedan en estado PENDING y deben ser enlazados a una entidad (ej. Transacción) o serán eliminados automáticamente.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|pdf)$/)) {
          return cb(
            new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp) y PDFs'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se enviaron archivos');
    }
    return this.storageService.uploadMultipleFiles(files, req.user?.sub);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un archivo',
    description: 'Elimina un archivo. Solo se permite si el archivo está en estado PENDING y pertenece al usuario que lo subió.',
  })
  async deleteFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    return this.storageService.deletePendingFile(id, req.user?.sub);
  }
}
