import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Banners (Admin)')
@Controller('banners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  @RequirePermissions('CREATE_BANNERS')
  create(@Body() createBannerDto: CreateBannerDto) {
    return this.bannersService.create(createBannerDto);
  }

  @Post('upload-image')
  @RequirePermissions('CREATE_BANNERS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
      }
      cb(null, true);
    }
  }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se envió ningún archivo');
    }
    return this.bannersService.uploadImage(file);
  }

  @Get()
  @RequirePermissions('READ_BANNERS')
  findAll() {
    return this.bannersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_BANNERS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_BANNERS')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateBannerDto: UpdateBannerDto) {
    return this.bannersService.update(id, updateBannerDto);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_BANNERS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bannersService.remove(id);
  }
}
