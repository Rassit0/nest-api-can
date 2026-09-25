import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFiles, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { HomeDisciplinesService } from './home-disciplines.service';
import { CreateHomeDisciplineDto } from './dto/create-home-discipline.dto';
import { UpdateHomeDisciplineDto } from './dto/update-home-discipline.dto';
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

@ApiTags('Home Disciplines (Admin)')
@Controller('home-disciplines')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class HomeDisciplinesController {
  constructor(private readonly homeDisciplinesService: HomeDisciplinesService) {}

  @Post()
  @RequirePermissions('CREATE_BANNERS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image4x3', maxCount: 1 },
  ], {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  create(
    @Body() createHomeDisciplineDto: CreateHomeDisciplineDto,
    @UploadedFiles() files: { image4x3?: Express.Multer.File[] }
  ) {
    if (!files || !files.image4x3 || files.image4x3.length === 0) {
      throw new BadRequestException('La imagen image4x3 es obligatoria para crear una home discipline.');
    }
    return this.homeDisciplinesService.create(createHomeDisciplineDto, files);
  }

  @Get()
  @RequirePermissions('READ_BANNERS')
  findAll() {
    return this.homeDisciplinesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_BANNERS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.homeDisciplinesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_BANNERS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'image4x3', maxCount: 1 },
  ], {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateHomeDisciplineDto: UpdateHomeDisciplineDto,
    @UploadedFiles() files: { image4x3?: Express.Multer.File[] }
  ) {
    return this.homeDisciplinesService.update(id, updateHomeDisciplineDto, files);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_BANNERS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.homeDisciplinesService.remove(id);
  }
}
