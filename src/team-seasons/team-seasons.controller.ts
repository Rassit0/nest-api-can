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
import { TeamSeasonsService } from './team-seasons.service';
import { CreateTeamSeasonsDto } from './dto/create-team-seasons.dto';
import { UpdateTeamSeasonDto } from './dto/update-team-seasons.dto';
import { TeamSeasonsPaginationDto } from './dto/pagination.dto';
import { CancelTeamSeasonDto } from './dto/cancel.dto';
import { FinalizeTeamSeasonDto } from './dto/finalize.dto';
import { ExtendTeamSeasonDto } from './dto/extend.dto';

@Controller('team-seasons')
export class TeamSeasonsController {
  constructor(private readonly teamOferingsService: TeamSeasonsService) {}

  @Post()
  async create(@Body() createTeamOferringDto: CreateTeamSeasonsDto) {
    return await this.teamOferingsService.create(createTeamOferringDto);
  }

  @Get()
  async findAll(@Query() paginationDto: TeamSeasonsPaginationDto) {
    return await this.teamOferingsService.findAll(paginationDto);
  }

  @Patch(':id/finalize')
  async finalize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() finalizeTeamSeasonDto: FinalizeTeamSeasonDto,
  ) {
    return await this.teamOferingsService.finalize(id, finalizeTeamSeasonDto);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelTeamSeasonDto: CancelTeamSeasonDto,
  ) {
    return await this.teamOferingsService.cancel(id, cancelTeamSeasonDto);
  }

  @Patch(':id/extend')
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() extendTeamSeasonDto: ExtendTeamSeasonDto,
  ) {
    return await this.teamOferingsService.extend(id, extendTeamSeasonDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamOferingsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamOferringDto: UpdateTeamSeasonDto,
  ) {
    return await this.teamOferingsService.update(id, updateTeamOferringDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.teamOferingsService.remove(id);
  }
}
