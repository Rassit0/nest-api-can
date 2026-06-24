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
import { TeamSeasonService } from './team-season.service';
import { CreateTeamSeasonDto } from './dto/create-team-season.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-season.dto';
import { TeamCategorySeasonsPaginationDto } from './dto/pagination.dto';
import { ApiConsumes } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

@Controller('team-seasons')
export class TeamSeasonsController {
  constructor(private readonly teamSeasonsService: TeamSeasonService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  async create(@Body() createTeamCategoryDto: CreateTeamSeasonDto) {
    return await this.teamSeasonsService.create(createTeamCategoryDto);
  }

  @Get()
  async findAll(@Query() paginationDto: TeamCategorySeasonsPaginationDto) {
    return await this.teamSeasonsService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.findOne(id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamCategoryDto: UpdateTeamSeasonDto,
  ) {
    return this.teamSeasonsService.update(id, updateTeamCategoryDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonsService.remove(id);
  }

  @Get('categories-by-discipline/options/:disciplineId')
  async getCategoriesByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamSeasonsService.getCategoriesByDisciplineOptions(
      disciplineId,
    );
  }

  @Get('seasons-by-discipline/options/:disciplineId')
  async getSeasonsByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamSeasonsService.getSeasonsByDisciplineOptions(
      disciplineId,
    );
  }
}
