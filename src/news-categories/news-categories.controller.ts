import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { NewsCategoriesService } from './news-categories.service';
import { CreateNewsCategoryDto } from './dto/create-news-category.dto';
import { UpdateNewsCategoryDto } from './dto/update-news-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('news-categories')
@UseGuards(JwtAuthGuard)
export class NewsCategoriesController {
  constructor(private readonly newsCategoriesService: NewsCategoriesService) {}

  @Post()
  @RequirePermissions('MANAGE_WEB')
  create(@Body() createNewsCategoryDto: CreateNewsCategoryDto) {
    return this.newsCategoriesService.create(createNewsCategoryDto);
  }

  @Get()
  @RequirePermissions('MANAGE_WEB')
  findAll() {
    return this.newsCategoriesService.findAll();
  }

  @Get('active')
  findActive() {
    return this.newsCategoriesService.findActive();
  }

  @Get(':id')
  @RequirePermissions('MANAGE_WEB')
  findOne(@Param('id') id: string) {
    return this.newsCategoriesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('MANAGE_WEB')
  update(@Param('id') id: string, @Body() updateNewsCategoryDto: UpdateNewsCategoryDto) {
    return this.newsCategoriesService.update(id, updateNewsCategoryDto);
  }

  @Get(':id/news-slugs')
  @RequirePermissions('MANAGE_WEB')
  findNewsSlugs(@Param('id') id: string) {
    return this.newsCategoriesService.findNewsSlugs(id);
  }

  @Delete(':id')
  @RequirePermissions('MANAGE_WEB')
  remove(@Param('id') id: string) {
    return this.newsCategoriesService.remove(id);
  }
}
