import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { NewsService } from './news.service';
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
  constructor(private readonly newsService: NewsService) {}

  @Post()
  @RequirePermissions('CREATE_NEWS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('cover', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  create(
    @Body() createNewsDto: CreateNewsDto,
    @UploadedFile() cover?: Express.Multer.File
  ) {
    return this.newsService.create(createNewsDto, cover);
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
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateNewsDto: UpdateNewsDto,
    @UploadedFile() cover?: Express.Multer.File
  ) {
    return this.newsService.update(id, updateNewsDto, cover);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_NEWS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.remove(id);
  }
}
