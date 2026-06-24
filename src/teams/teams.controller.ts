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
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsPaginationDto } from './dto/pagination.dto';
import { ApiConsumes } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamsService.create(createTeamDto);
  }

  @Get()
  findAll(@Query() paginationDto: TeamsPaginationDto) {
    return this.teamsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(id, updateTeamDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamsService.remove(id);
  }

  @Get('clubs-by-discipline/options/:disciplineId')
  async getClubsByDisciplineOptions(
    @Param('disciplineId', ParseUUIDPipe) disciplineId: string,
  ) {
    return await this.teamsService.getClubsByDisciplineOptions(disciplineId);
  }

  @Get('disciplines/options')
  async getDisciplinesOptions() {
    return await this.teamsService.getDisciplinesOptions();
  }
}
