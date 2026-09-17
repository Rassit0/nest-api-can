import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFiles, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
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

@ApiTags('Promotions (Admin)')
@Controller('promotions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @RequirePermissions('CREATE_PROMOTIONS')
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
    @Body() createPromotionDto: CreatePromotionDto,
    @UploadedFiles() files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }
  ) {
    if (!files || !files.image16x9 || files.image16x9.length === 0) {
      throw new BadRequestException('La imagen image16x9 es obligatoria para crear una promoción.');
    }
    return this.promotionsService.create(createPromotionDto, files);
  }

  @Get()
  @RequirePermissions('READ_PROMOTIONS')
  findAll() {
    return this.promotionsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_PROMOTIONS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_PROMOTIONS')
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
    @Body() updatePromotionDto: UpdatePromotionDto,
    @UploadedFiles() files: { image16x9?: Express.Multer.File[], image1x1?: Express.Multer.File[], image3x4?: Express.Multer.File[] }
  ) {
    return this.promotionsService.update(id, updatePromotionDto, files);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_PROMOTIONS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotionsService.remove(id);
  }
}
