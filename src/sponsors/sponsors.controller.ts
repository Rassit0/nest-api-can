import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

const imageFileFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|svg\+xml)$/)) {
    return cb(new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, webp, svg)'), false);
  }
  cb(null, true);
};

@ApiTags('Sponsors (Admin)')
@Controller('sponsors')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Post()
  @RequirePermissions('CREATE_SPONSORS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  create(
    @Body() createSponsorDto: CreateSponsorDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria para crear un auspiciador.');
    }
    return this.sponsorsService.create(createSponsorDto, file);
  }

  @Get()
  @RequirePermissions('READ_SPONSORS')
  findAll() {
    return this.sponsorsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('READ_SPONSORS')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sponsorsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('UPDATE_SPONSORS')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
  }))
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateSponsorDto: UpdateSponsorDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.sponsorsService.update(id, updateSponsorDto, file);
  }

  @Delete(':id')
  @RequirePermissions('DELETE_SPONSORS')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.sponsorsService.remove(id);
  }
}
