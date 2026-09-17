import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFiles, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { HeroBannersService } from './hero-banners.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
  }
  cb(null, true);
};

@ApiTags('Hero Banners (Admin)')
@Controller('hero-banners')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class HeroBannersController {
  constructor(private readonly heroBannersService: HeroBannersService) {}

  @Post()
  @RequirePermissions('CREATE_BANNERS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image16x9', maxCount: 1 },
    { name: 'image1x1', maxCount: 1 },
    { name: 'image3x4', maxCount: 1 },
  ], {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  create(
    @Body() createHeroBannerDto: CreateHeroBannerDto,
    @UploadedFiles() files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }
  ) {
    if (!files || !files.image16x9 || files.image16x9.length === 0) {
      throw new BadRequestException('La imagen image16x9 es obligatoria para crear un hero banner.');
    }
    return this.heroBannersService.create(createHeroBannerDto, files);
  }

  @Get()
  @RequirePermissions('READ_BANNERS')
  findAll() {
    return this.heroBannersService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_BANNERS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.heroBannersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_BANNERS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image16x9', maxCount: 1 },
    { name: 'image1x1', maxCount: 1 },
    { name: 'image3x4', maxCount: 1 },
  ], {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateHeroBannerDto: UpdateHeroBannerDto,
    @UploadedFiles() files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }
  ) {
    return this.heroBannersService.update(id, updateHeroBannerDto, files);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_BANNERS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.heroBannersService.remove(id);
  }
}
