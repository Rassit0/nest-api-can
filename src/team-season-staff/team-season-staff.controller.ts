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
import { TeamSeasonStaffService } from './team-season-staff.service';
import { CreateTeamSeasonStaffDto } from './dto/create-team-season-staff.dto';
import { UpdateTeamSeasonStaffDto } from './dto/update-team-season-staff.dto';
import { TeamSeasonStaffPaginationDto } from './dto/pagination.dto';

@Controller('team-season-staff')
export class TeamSeasonStaffController {
  constructor(
    private readonly teamSeasonStaffService: TeamSeasonStaffService,
  ) {}

  @Post()
  create(@Body() createTeamSeasonStaffDto: CreateTeamSeasonStaffDto) {
    return this.teamSeasonStaffService.create(createTeamSeasonStaffDto);
  }

  @Get()
  async findAll(@Query() paginationDto: TeamSeasonStaffPaginationDto) {
    return await this.teamSeasonStaffService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamSeasonStaffService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamSeasonStaffDto: UpdateTeamSeasonStaffDto,
  ) {
    return this.teamSeasonStaffService.update(id, updateTeamSeasonStaffDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamSeasonStaffService.remove(id);
  }
}
