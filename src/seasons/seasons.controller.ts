import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { SeasonsPaginationDto } from './dto/pagination.dto';

@Controller('seasons')
export class SeasonsController {
  constructor(private readonly seasonsService: SeasonsService) {}

  @Post()
  async create(@Body() createSeasonDto: CreateSeasonDto) {
    return await this.seasonsService.create(createSeasonDto);
  }

  @Get()
  async findAll(@Query() paginationDto: SeasonsPaginationDto) {
    return await this.seasonsService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.seasonsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSeasonDto: UpdateSeasonDto,
  ) {
    return await this.seasonsService.update(id, updateSeasonDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.seasonsService.remove(id);
  }
}
