import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe, Req } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsAssetService } from './news-asset.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp)'), false);
  }
  cb(null, true);
};

@ApiTags('News (Admin)')
@Controller('news')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class NewsController {
  constructor(
    private readonly newsService: NewsService,
    private readonly newsAssetService: NewsAssetService,
  ) {}

  @Post('assets')
  @RequirePermissions('CREATE_NEWS', 'UPDATE_NEWS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  uploadAsset(
    @Body('uploadSessionId') uploadSessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.newsAssetService.uploadTemp(file, uploadSessionId, req.user.id);
  }

  @Post('assets/cancel-session')
  @RequirePermissions('CREATE_NEWS', 'UPDATE_NEWS')
  cancelSession(
    @Body('uploadSessionId') uploadSessionId: string,
    @Req() req: any
  ) {
    return this.newsAssetService.cancelSession(uploadSessionId, req.user.id);
  }

  @Post()
  @RequirePermissions('CREATE_NEWS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('cover', {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  create(
    @Body() createNewsDto: CreateNewsDto,
    @Req() req: any,
    @UploadedFile() cover?: Express.Multer.File
  ) {
    return this.newsService.create(createNewsDto, req.user.id, cover);
  }

  @Get()
  @RequirePermissions('READ_NEWS')
  findAll() {
    return this.newsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_NEWS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_NEWS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('cover', {
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateNewsDto: UpdateNewsDto,
    @Req() req: any,
    @UploadedFile() cover?: Express.Multer.File
  ) {
    return this.newsService.update(id, updateNewsDto, req.user.id, cover);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_NEWS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.remove(id);
  }
}
